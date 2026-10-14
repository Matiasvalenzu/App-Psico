from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .services import request_notification_email_change, verify_notification_email


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class NotificationEmailVerificationTests(TestCase):
    @patch("cuentas.services.secrets.randbelow", return_value=123456)
    def test_invalid_attempt_is_persisted_before_valid_verification(self, _randbelow):
        user = get_user_model().objects.create_user(
            username="profile-test",
            email="login@example.com",
        )
        profile = user.perfil_psicologo
        request_notification_email_change(profile, "notifications@example.com")

        with self.assertRaisesMessage(Exception, "no es válido"):
            verify_notification_email(user, "000000")
        profile.refresh_from_db()
        self.assertEqual(profile.email_verificacion_intentos, 1)

        verify_notification_email(user, "123456")
        profile.refresh_from_db()
        self.assertEqual(profile.email_notificaciones, "notifications@example.com")
        self.assertEqual(profile.email_verificacion_intentos, 0)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RegistrationFlowTests(TestCase):
    def setUp(self):
        self.User = get_user_model()

    @patch("cuentas.services.secrets.randbelow", return_value=654321)
    def test_registration_request_and_confirmation(self, _mock_rand):
        from .services import request_user_registration, confirm_user_registration
        from .models import CodigoVerificacionRegistro

        # 1. Solicitar registro
        result = request_user_registration(
            first_name="Constanza",
            last_name="Valenzuela",
            email="constanza@psicologia.cl",
            password="Password123!Safe",
        )
        self.assertTrue(result)

        pending = CodigoVerificacionRegistro.objects.get(email="constanza@psicologia.cl")
        self.assertEqual(pending.first_name, "Constanza")
        self.assertEqual(pending.last_name, "Valenzuela")
        self.assertFalse(self.User.objects.filter(email="constanza@psicologia.cl").exists())

        # 2. Intento con código erróneo
        with self.assertRaises(Exception):
            confirm_user_registration("constanza@psicologia.cl", "111111")
        pending.refresh_from_db()
        self.assertEqual(pending.intentos, 1)

        # 3. Confirmación con código correcto
        user = confirm_user_registration("constanza@psicologia.cl", "654321")
        self.assertIsNotNone(user)
        self.assertEqual(user.email, "constanza@psicologia.cl")
        self.assertTrue(user.check_password("Password123!Safe"))
        self.assertFalse(CodigoVerificacionRegistro.objects.filter(email="constanza@psicologia.cl").exists())

        # 4. Verificar suscripción de prueba de 14 días
        self.assertTrue(hasattr(user, "suscripcion"))
        self.assertEqual(user.suscripcion.estado, "trial")
        self.assertTrue(user.suscripcion.is_active_or_trial)

    def test_duplicate_email_registration_rejected(self):
        from .services import request_user_registration

        self.User.objects.create_user(
            username="existente",
            email="existente@psiconex.cl",
            password="SomePassword123!",
        )

        with self.assertRaises(Exception):
            request_user_registration(
                first_name="Test",
                last_name="User",
                email="existente@psiconex.cl",
                password="OtherPassword123!",
            )

    def test_dual_authentication_backend(self):
        from .backends import EmailOrUsernameModelBackend

        backend = EmailOrUsernameModelBackend()
        user = self.User.objects.create_user(
            username="psicologo_1",
            email="terapia@clinica.cl",
            password="SecurePassword456!",
        )

        # Autenticar por username
        auth_user = backend.authenticate(None, username="psicologo_1", password="SecurePassword456!")
        self.assertEqual(auth_user, user)

        # Autenticar por email exacto
        auth_email = backend.authenticate(None, username="terapia@clinica.cl", password="SecurePassword456!")
        self.assertEqual(auth_email, user)

        # Autenticar por email en mayúsculas (case-insensitive)
        auth_case = backend.authenticate(None, username="TERAPIA@CLINICA.CL", password="SecurePassword456!")
        self.assertEqual(auth_case, user)

        # Autenticar con clave errónea falla
        self.assertIsNone(backend.authenticate(None, username="terapia@clinica.cl", password="WrongPassword!"))

    @patch("cuentas.services.secrets.randbelow", return_value=888999)
    def test_api_registration_and_token_obtain(self, _randbelow):
        from rest_framework.test import APIClient
        client = APIClient()

        # 1. Register API
        res = client.post(
            "/api/auth/register/",
            {
                "first_name": "Valeria",
                "last_name": "Castro",
                "email": "valeria@psico.cl",
                "password": "StrongPassword789!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        # 2. Verify API
        res_verify = client.post(
            "/api/auth/register/verify/",
            {
                "email": "valeria@psico.cl",
                "code": "888999",
            },
            format="json",
        )
        self.assertEqual(res_verify.status_code, 201)
        self.assertIn("access", res_verify.data)
        self.assertIn("refresh", res_verify.data)

        # 3. Login with email
        res_login = client.post(
            "/api/auth/token/",
            {
                "username": "valeria@psico.cl",
                "password": "StrongPassword789!",
            },
            format="json",
        )
        self.assertEqual(res_login.status_code, 200)
        self.assertIn("access", res_login.data)

        # 4. Check current_user endpoint has trial days and tutorial_visto
        token = res_login.data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res_me = client.get("/api/auth/me/")
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.data["suscripcion_estado"], "trial")
        self.assertEqual(res_me.data["dias_restantes_prueba"], 14)
        self.assertIn("tutorial_visto", res_me.data)
        self.assertFalse(res_me.data["tutorial_visto"])

        # 5. Update tutorial_visto via PATCH /api/cuenta/perfil/
        res_patch = client.patch(
            "/api/cuenta/perfil/",
            {"tutorial_visto": True},
            format="json",
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertTrue(res_patch.data["tutorial_visto"])

        # 6. Verify current_user endpoint reflects tutorial_visto = True
        res_me_updated = client.get("/api/auth/me/")
        self.assertEqual(res_me_updated.status_code, 200)
        self.assertTrue(res_me_updated.data["tutorial_visto"])
        self.assertTrue(res_me_updated.data["tutoriales_vistos"]["bienvenida"])

        res_agenda = client.patch(
            "/api/cuenta/perfil/",
            {"tutoriales_vistos": {"agenda": True}},
            format="json",
        )
        self.assertEqual(res_agenda.status_code, 200)
        res_voz = client.patch(
            "/api/cuenta/perfil/",
            {"tutoriales_vistos": {"voz": True}},
            format="json",
        )
        self.assertEqual(res_voz.status_code, 200)
        self.assertTrue(res_voz.data["tutoriales_vistos"]["agenda"])
        self.assertTrue(res_voz.data["tutoriales_vistos"]["voz"])
        res_bad = client.patch(
            "/api/cuenta/perfil/",
            {"tutoriales_vistos": {"suscripcion": True}},
            format="json",
        )
        self.assertEqual(res_bad.status_code, 400)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PUBLIC_APP_URL="http://testserver",
)
class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        mail.outbox.clear()
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="reset-user",
            email="reset@psiconex.cl",
            password="Password123!Safe",
            first_name="Ana",
        )

    def _reset_link_parts(self):
        import re

        raw = mail.outbox[0].message().as_string().replace("=\r\n", "").replace("=\n", "").replace("&amp;", "&")
        match = re.search(r"/restablecer-contrasena\?uid=([^&\s]+)&token=([^&\s\"<>]+)", raw)
        self.assertIsNotNone(match)
        uid, token = match.group(1), match.group(2)
        return uid, token, f"http://testserver/restablecer-contrasena?uid={uid}&token={token}"

    def test_existing_email_sends_reset_link(self):
        res = self.client.post(
            "/api/auth/password-reset/",
            {"email": "Reset@Psiconex.cl"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Restablece tu contraseña de Psiconex")
        uid, token, url = self._reset_link_parts()
        self.assertIn("/restablecer-contrasena?", url)
        self.assertTrue(uid)
        self.assertTrue(token)

    def test_unknown_email_returns_200_without_email(self):
        res = self.client.post(
            "/api/auth/password-reset/",
            {"email": "nadie@psiconex.cl"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIn("Si el correo está registrado", res.data["detail"])

    def test_confirm_changes_password_and_invalidates_token(self):
        self.client.post("/api/auth/password-reset/", {"email": "reset@psiconex.cl"}, format="json")
        uid, token, _url = self._reset_link_parts()
        res = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "new_password": "NuevaClave456!Segura"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NuevaClave456!Segura"))
        reused = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "new_password": "OtraClave789!Segura"},
            format="json",
        )
        self.assertEqual(reused.status_code, 400)

    def test_invalid_token_returns_400(self):
        res = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": "abc", "token": "invalido", "new_password": "NuevaClave456!Segura"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_weak_password_returns_400(self):
        self.client.post("/api/auth/password-reset/", {"email": "reset@psiconex.cl"}, format="json")
        uid, token, _url = self._reset_link_parts()
        res = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "new_password": "corta"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Password123!Safe"))



class EliminarCuentaTests(TestCase):
    def setUp(self):
        import tempfile

        from django.test import override_settings as _override

        self.audio_root = tempfile.mkdtemp()
        override = _override(AUDIO_STORAGE_PATH=self.audio_root)
        override.enable()
        self.addCleanup(override.disable)
        self.user = get_user_model().objects.create_user(
            username="borrar", email="borrar@example.com", password="Clave-segura-1"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _crear_datos(self):
        import os

        from pacientes.models import Paciente
        from sesiones.audio import carpeta_audio_paciente

        paciente = Paciente.objects.create(psicologo=self.user, nombre="Ana", apellido="Rojas")
        carpeta = carpeta_audio_paciente(paciente.id)
        os.makedirs(carpeta)
        with open(os.path.join(carpeta, "1.webm"), "wb") as f:
            f.write(b"audio")
        return paciente, carpeta

    @patch("suscripciones.views._get_mp_sdk")
    def test_elimina_bd_archivos_y_cancela_mp(self, mock_sdk):
        import os

        from pacientes.models import Paciente

        self.user.suscripcion.mp_preapproval_id = "pre-123"
        self.user.suscripcion.save()
        paciente, carpeta = self._crear_datos()

        response = self.client.post("/api/cuenta/eliminar/", {"password": "Clave-segura-1"})

        self.assertEqual(response.status_code, 200)
        self.assertFalse(get_user_model().objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Paciente.objects.filter(pk=paciente.pk).exists())
        self.assertFalse(os.path.exists(carpeta))
        mock_sdk.return_value.preapproval.return_value.update.assert_called_once_with(
            "pre-123", {"status": "cancelled"}
        )

    @patch("suscripciones.views._get_mp_sdk", side_effect=RuntimeError("MP caído"))
    def test_fallo_de_mp_no_impide_eliminar(self, _mock_sdk):
        self.user.suscripcion.mp_preapproval_id = "pre-123"
        self.user.suscripcion.save()
        response = self.client.post("/api/cuenta/eliminar/", {"password": "Clave-segura-1"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(get_user_model().objects.filter(pk=self.user.pk).exists())

    def test_contrasena_incorrecta_no_elimina(self):
        response = self.client.post("/api/cuenta/eliminar/", {"password": "otra"})
        self.assertEqual(response.status_code, 400)
        self.assertTrue(get_user_model().objects.filter(pk=self.user.pk).exists())

    def test_usuario_google_confirma_escribiendo_eliminar(self):
        self.user.set_unusable_password()
        self.user.save()
        response = self.client.post("/api/cuenta/eliminar/", {"confirmacion": "borrar"})
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/cuenta/eliminar/", {"confirmacion": "ELIMINAR"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(get_user_model().objects.filter(pk=self.user.pk).exists())


class ExportacionTests(TestCase):
    def setUp(self):
        from chat.models import InformeIA
        from pacientes.models import Paciente
        from sesiones.models import Sesion, TranscripcionSegmento

        self.user = get_user_model().objects.create_user(username="exporta", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(psicologo=self.user, nombre="Ana", apellido="Rojas")
        sesion = Sesion.objects.create(paciente=self.paciente, psicologo=self.user)
        TranscripcionSegmento.objects.create(
            sesion=sesion, orden=1, inicio_segundo=0, fin_segundo=2,
            hablante="PACIENTE", texto="Hola, vengo por ansiedad.", embedding=[0.1] * 1024,
        )
        InformeIA.objects.create(
            paciente=self.paciente, psicologo=self.user, contenido="**Resumen** clínico"
        )

    def _zip(self, response):
        import io
        import zipfile

        self.assertEqual(response.status_code, 200)
        return zipfile.ZipFile(io.BytesIO(b"".join(response.streaming_content)))

    def test_exportar_cuenta_incluye_json_y_pdfs(self):
        import json

        zf = self._zip(self.client.get("/api/cuenta/exportar/"))
        nombres = zf.namelist()
        carpeta = f"pacientes/rojas-ana-{self.paciente.id}"
        self.assertIn("cuenta.json", nombres)
        self.assertIn(f"{carpeta}/datos.json", nombres)
        self.assertTrue(any(n.startswith(f"{carpeta}/sesiones/") and n.endswith(".pdf") for n in nombres))
        self.assertTrue(any(n.startswith(f"{carpeta}/informes/") for n in nombres))
        datos = json.loads(zf.read(f"{carpeta}/datos.json"))
        segmento = datos["sesiones"][0]["segmentos"][0]
        self.assertEqual(segmento["texto"], "Hola, vengo por ansiedad.")
        self.assertNotIn("embedding", segmento)
        self.assertTrue(zf.read(nombres[-1]).startswith(b"%PDF"))

    def test_exportar_paciente_solo_del_propio_profesional(self):
        zf = self._zip(self.client.get(f"/api/pacientes/{self.paciente.id}/exportar/"))
        self.assertIn(f"rojas-ana-{self.paciente.id}/datos.json", zf.namelist())

        otro = get_user_model().objects.create_user(username="otro-exp", password="x")
        self.client.force_authenticate(user=otro)
        response = self.client.get(f"/api/pacientes/{self.paciente.id}/exportar/")
        self.assertEqual(response.status_code, 404)

    def test_pdf_de_sesion_sigue_funcionando(self):
        sesion = self.paciente.sesiones.first()
        response = self.client.get(f"/api/sesiones/{sesion.id}/exportar_pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF"))

    def test_pdf_de_informe_sigue_funcionando(self):
        informe = self.paciente.informes_ia.first()
        response = self.client.get(f"/api/chat/informes/{informe.id}/exportar_pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF"))


class RegistroAccesoTests(TestCase):
    def setUp(self):
        from pacientes.models import Paciente

        self.user = get_user_model().objects.create_user(username="audita", password="x")
        self.otro = get_user_model().objects.create_user(username="ajeno", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(psicologo=self.user, nombre="Ana", apellido="Rojas")

    def test_ver_ficha_registra_una_vez_en_la_ventana(self):
        from .models import RegistroAcceso

        self.assertEqual(self.client.get(f"/api/pacientes/{self.paciente.id}/").status_code, 200)
        self.client.get(f"/api/pacientes/{self.paciente.id}/")
        registros = RegistroAcceso.objects.filter(usuario=self.user)
        self.assertEqual(registros.count(), 1)
        self.assertEqual(registros[0].accion, RegistroAcceso.Accion.VER_FICHA)
        self.assertEqual(registros[0].paciente, self.paciente)

    def test_eliminar_paciente_conserva_el_registro(self):
        from .models import RegistroAcceso

        self.assertEqual(self.client.delete(f"/api/pacientes/{self.paciente.id}/").status_code, 204)
        registro = RegistroAcceso.objects.get(usuario=self.user)
        self.assertEqual(registro.accion, RegistroAcceso.Accion.ELIMINAR)
        self.assertIsNone(registro.paciente)

    def test_actividad_solo_muestra_lo_propio(self):
        from .models import RegistroAcceso

        RegistroAcceso.objects.create(usuario=self.otro, accion=RegistroAcceso.Accion.EXPORTAR)
        self.client.get(f"/api/pacientes/{self.paciente.id}/")
        data = self.client.get("/api/cuenta/actividad/").json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["paciente"], "Ana Rojas")
        self.assertEqual(data[0]["accion"], "VER_FICHA")

    def test_purga_registros_de_mas_de_un_anio(self):
        from datetime import timedelta

        from django.utils import timezone

        from .models import RegistroAcceso
        from .tasks import purgar_registros_acceso

        viejo = RegistroAcceso.objects.create(usuario=self.user, accion=RegistroAcceso.Accion.EXPORTAR)
        RegistroAcceso.objects.filter(pk=viejo.pk).update(fecha=timezone.now() - timedelta(days=400))
        RegistroAcceso.objects.create(usuario=self.user, accion=RegistroAcceso.Accion.EXPORTAR)
        self.assertEqual(purgar_registros_acceso(), 1)
        self.assertEqual(RegistroAcceso.objects.count(), 1)
