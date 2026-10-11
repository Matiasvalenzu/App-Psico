from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Suscripcion

User = get_user_model()


class SuscripcionesApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="psicologo_test@psiconex.cl",
            email="psicologo_test@psiconex.cl",
            password="TestPassword123!",
        )
        self.client.force_authenticate(user=self.user)

    def test_suscripcion_creada_en_registro(self):
        suscripcion = self.user.suscripcion
        self.assertEqual(suscripcion.estado, "trial")
        self.assertTrue(suscripcion.is_active_or_trial)
        self.assertIsNotNone(suscripcion.fin_prueba)

    def test_estado_endpoint(self):
        response = self.client.get("/api/suscripciones/estado/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["estado"], "trial")
        self.assertTrue(response.data["is_active_or_trial"])
        self.assertIn("dias_restantes_prueba", response.data)
        self.assertIn("public_key", response.data)

    @patch("suscripciones.views._get_mp_sdk")
    def test_contratar_card_defiere_cobro_en_trial(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().create.return_value = {
            "status": 201,
            "response": {
                "id": "preapproval_123456",
                "payer_id": 987654321,
                "status": "authorized",
            },
        }

        payload = {
            "token": "tok_visa_valid_123",
            "payment_method_id": "visa",
            "card_last_four": "4242",
        }
        response = self.client.post("/api/suscripciones/contratar/", payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["card_brand"], "visa")
        self.assertEqual(response.data["card_last_four"], "4242")

        # Verificar que se llamó con start_date programado
        call_args = mock_sdk.preapproval().create.call_args[0][0]
        self.assertIn("start_date", call_args["auto_recurring"])
        self.assertEqual(call_args["card_token_id"], "tok_visa_valid_123")

        # Verificar BD actualizada
        self.user.suscripcion.refresh_from_db()
        self.assertEqual(self.user.suscripcion.estado, "activa")
        self.assertEqual(self.user.suscripcion.mp_preapproval_id, "preapproval_123456")
        self.assertEqual(self.user.suscripcion.card_last_four, "4242")

    @patch("suscripciones.views._get_mp_sdk")
    def test_cancelar_suscripcion(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().update.return_value = {"status": 200}

        suscripcion = self.user.suscripcion
        suscripcion.estado = "activa"
        suscripcion.mp_preapproval_id = "preapproval_123456"
        suscripcion.save()

        response = self.client.post("/api/suscripciones/cancelar/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

        suscripcion.refresh_from_db()
        self.assertEqual(suscripcion.estado, "cancelada")
        self.assertIsNotNone(suscripcion.cancelada_en)


class SoloLecturaTests(APITestCase):
    """El middleware autentica con JWT: se usa el token real, no force_authenticate."""

    def setUp(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        self.user = User.objects.create_user(
            username="lectura@psiconex.cl", email="lectura@psiconex.cl", password="TestPassword123!"
        )
        self.suscripcion = self.user.suscripcion
        token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _estado(self, estado, hace_dias=0):
        self.suscripcion.estado = estado
        self.suscripcion.save()
        if hace_dias:
            Suscripcion.objects.filter(pk=self.suscripcion.pk).update(
                inactiva_desde=timezone.now() - timedelta(days=hace_dias)
            )
            self.suscripcion.refresh_from_db()

    def test_cancelada_bloquea_escritura_y_permite_lectura(self):
        self._estado("cancelada")
        response = self.client.post("/api/pacientes/", {}, format="json", secure=True)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "subscription_inactive")
        self.assertEqual(self.client.get("/api/pacientes/", secure=True).status_code, 200)

    def test_trial_vigente_puede_escribir(self):
        response = self.client.post("/api/pacientes/", {}, format="json", secure=True)
        self.assertNotEqual(response.status_code, 403)

    def test_trial_vencido_queda_en_solo_lectura(self):
        Suscripcion.objects.filter(pk=self.suscripcion.pk).update(
            fin_prueba=timezone.now() - timedelta(days=2)
        )
        response = self.client.post("/api/pacientes/", {}, format="json", secure=True)
        self.assertEqual(response.status_code, 403)
        me = self.client.get("/api/auth/me/", secure=True).json()
        self.assertTrue(me["solo_lectura"])
        self.assertEqual(me["dias_para_purga"], 28)

    def test_past_due_tiene_gracia_de_siete_dias(self):
        self._estado("past_due", hace_dias=3)
        self.assertTrue(self.suscripcion.puede_escribir)
        response = self.client.post("/api/pacientes/", {}, format="json", secure=True)
        self.assertNotEqual(response.status_code, 403)
        self._estado("past_due", hace_dias=8)
        self.assertFalse(self.suscripcion.puede_escribir)

    def test_rutas_permitidas_y_sin_token_pasan(self):
        self._estado("expirada")
        response = self.client.post("/api/suscripciones/cancelar/", secure=True)
        self.assertNotEqual(response.status_code, 403)
        self.client.credentials()
        response = self.client.post("/api/pacientes/", {}, format="json", secure=True)
        self.assertEqual(response.status_code, 401)

    def test_inactiva_desde_se_conserva_y_se_limpia(self):
        self._estado("past_due", hace_dias=5)
        inicio = self.suscripcion.inactiva_desde
        self._estado("cancelada")
        self.assertEqual(self.suscripcion.inactiva_desde, inicio)
        self._estado("activa")
        self.assertIsNone(self.suscripcion.inactiva_desde)
        self.assertTrue(self.suscripcion.puede_escribir)

    @patch("suscripciones.views._get_mp_sdk")
    def test_webhook_authorized_reactiva(self, mock_sdk):
        self._estado("cancelada", hace_dias=10)
        mock_sdk.return_value.preapproval.return_value.get.return_value = {
            "status": 200,
            "response": {"external_reference": str(self.user.id), "status": "authorized"},
        }
        self.client.credentials()
        self.client.post(
            "/api/suscripciones/webhook/",
            {"type": "subscription_preapproval", "data": {"id": "pre-1"}},
            format="json",
            secure=True,
        )
        self.suscripcion.refresh_from_db()
        self.assertEqual(self.suscripcion.estado, "activa")
        self.assertIsNone(self.suscripcion.inactiva_desde)


class CicloSuscripcionesTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ciclo@psiconex.cl", email="ciclo@psiconex.cl", password="TestPassword123!"
        )
        self.suscripcion = self.user.suscripcion

    def _inactiva_hace(self, dias):
        self.suscripcion.estado = "cancelada"
        self.suscripcion.save()
        Suscripcion.objects.filter(pk=self.suscripcion.pk).update(
            inactiva_desde=timezone.now() - timedelta(days=dias)
        )

    def _avisos(self, tipo):
        from notificaciones.models import NotificacionEmail

        return NotificacionEmail.objects.filter(usuario=self.user, tipo=tipo).count()

    def test_expira_trial_vencido_desde_fin_prueba(self):
        from .tasks import ciclo_suscripciones

        fin = timezone.now() - timedelta(days=3)
        Suscripcion.objects.filter(pk=self.suscripcion.pk).update(fin_prueba=fin)
        ciclo_suscripciones()
        self.suscripcion.refresh_from_db()
        self.assertEqual(self.suscripcion.estado, "expirada")
        self.assertEqual(self.suscripcion.inactiva_desde, fin)
        self.assertEqual(self.suscripcion.dias_para_purga, 27)

    def test_aviso_siete_dias_una_sola_vez(self):
        from .tasks import ciclo_suscripciones

        self._inactiva_hace(25)
        ciclo_suscripciones()
        ciclo_suscripciones()
        self.assertEqual(self._avisos("AVISO_PURGA_7D"), 1)
        self.assertEqual(self._avisos("AVISO_PURGA_1D"), 0)

    def test_aviso_un_dia(self):
        from .tasks import ciclo_suscripciones

        self._inactiva_hace(29.5)
        ciclo_suscripciones()
        self.assertEqual(self._avisos("AVISO_PURGA_1D"), 1)
        self.assertEqual(self._avisos("AVISO_PURGA_7D"), 0)

    def test_sin_purga_activa_no_borra(self):
        from .tasks import ciclo_suscripciones

        self._inactiva_hace(31)
        with self.settings(PURGA_ACTIVA=False):
            ciclo_suscripciones()
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_purga_a_los_treinta_dias(self):
        from .tasks import ciclo_suscripciones

        self._inactiva_hace(31)
        with self.settings(PURGA_ACTIVA=True):
            resultado = ciclo_suscripciones()
        self.assertEqual(resultado["purgadas"], 1)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())

    def test_staff_no_se_purga(self):
        from .tasks import ciclo_suscripciones

        User.objects.filter(pk=self.user.pk).update(is_staff=True)
        self._inactiva_hace(31)
        with self.settings(PURGA_ACTIVA=True):
            ciclo_suscripciones()
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_aviso_se_omite_si_se_reactivo(self):
        from notificaciones.services import enqueue_purge_notice, notification_content

        self._inactiva_hace(25)
        self.suscripcion.refresh_from_db()
        aviso = enqueue_purge_notice(self.suscripcion, 7)
        contenido = notification_content(aviso)
        self.assertEqual(contenido["template"], "aviso_purga")
        self.assertIn("/dashboard/configuracion/privacidad", contenido["context"]["export_url"])
        self.suscripcion.estado = "activa"
        self.suscripcion.save()
        aviso.usuario.refresh_from_db()
        aviso = type(aviso).objects.get(pk=aviso.pk)
        self.assertIsNone(notification_content(aviso))
