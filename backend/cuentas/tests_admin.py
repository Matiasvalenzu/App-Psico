import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from cuentas.models import PerfilPsicologo, RegistroConsumoIA
from pacientes.models import Paciente
from sesiones.models import Sesion
from suscripciones.models import PagoPlusPendiente, Suscripcion

User = get_user_model()
SECRETO = "NombreClinicoSecretoNoDebeSalir"


def _clave():
    return "ClaveSegura123"


class ActividadLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="ana",
            email="ana@ejemplo.cl",
            password=_clave(),
        )

    def test_login_por_clave_actualiza_last_login_como_maximo_cada_hora(self):
        res = self.client.post(
            "/api/auth/token/",
            {"username": "ana@ejemplo.cl", "password": _clave()},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        primero = self.user.last_login
        self.assertIsNotNone(primero)

        self.client.post(
            "/api/auth/token/",
            {"username": "ana", "password": _clave()},
            format="json",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_login, primero)

        User.objects.filter(pk=self.user.pk).update(last_login=timezone.now() - timedelta(hours=2))
        self.client.post(
            "/api/auth/token/",
            {"username": "ana", "password": _clave()},
            format="json",
        )
        self.user.refresh_from_db()
        self.assertGreater(self.user.last_login, timezone.now() - timedelta(minutes=5))

    def test_refresh_actualiza_last_login_una_vez_por_hora(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        User.objects.filter(pk=self.user.pk).update(last_login=None)
        refresh = RefreshToken.for_user(self.user)
        res = self.client.post("/api/auth/token/refresh/", {"refresh": str(refresh)}, format="json")
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        primero = self.user.last_login
        self.assertIsNotNone(primero)

        otro = RefreshToken.for_user(self.user)
        self.client.post("/api/auth/token/refresh/", {"refresh": str(otro)}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_login, primero)

    @override_settings(GOOGLE_CLIENT_ID="google-client-id")
    @patch("notificaciones.tasks.send_notification.delay")
    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_actualiza_last_login(self, verify_token, _delay):
        verify_token.return_value = {
            "email": "ana@ejemplo.cl",
            "email_verified": True,
            "given_name": "Ana",
            "family_name": "Soto",
        }
        User.objects.filter(pk=self.user.pk).update(last_login=None)
        res = self.client.post("/api/auth/google/login/", {"credential": "token"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_middleware_actualiza_actividad_cada_15_minutos(self):
        res = self.client.post(
            "/api/auth/token/",
            {"username": "ana", "password": _clave()},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        self.client.get("/api/auth/me/")
        perfil = PerfilPsicologo.objects.get(user=self.user)
        self.assertIsNotNone(perfil.ultima_actividad)
        primera = perfil.ultima_actividad
        self.client.get("/api/auth/me/")
        perfil.refresh_from_db()
        self.assertEqual(perfil.ultima_actividad, primera)
        PerfilPsicologo.objects.filter(pk=perfil.pk).update(
            ultima_actividad=timezone.now() - timedelta(minutes=20)
        )
        self.client.get("/api/cuenta/perfil/")
        perfil.refresh_from_db()
        self.assertGreater(perfil.ultima_actividad, primera)


class PanelAdminTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(
            username="root",
            email="root@ejemplo.cl",
            password=_clave(),
        )
        self.superuser.suscripcion.estado = "expirada"
        self.superuser.suscripcion.fin_prueba = timezone.now() - timedelta(days=1)
        self.superuser.suscripcion.save()
        self.interna = User.objects.create_user("interna", "interna@ejemplo.cl", _clave())
        self.interna.perfil_psicologo.es_interna = True
        self.interna.perfil_psicologo.save()
        self.psico = User.objects.create_user("psico", "psico@ejemplo.cl", _clave())
        self.psico.perfil_psicologo.ultima_actividad = timezone.now()
        self.psico.perfil_psicologo.utm_source = "google"
        self.psico.perfil_psicologo.save()
        self.psico.suscripcion.estado = "activa"
        self.psico.suscripcion.plan = "plus"
        self.psico.suscripcion.proximo_cobro = timezone.now() + timedelta(days=2)
        self.psico.suscripcion.card_brand = "visa"
        self.psico.suscripcion.card_last_four = "4242"
        self.psico.suscripcion.save()
        self.paciente = Paciente.objects.create(
            psicologo=self.psico,
            nombre=SECRETO,
            apellido="Oculto",
            diagnostico_sospechado="diagnostico secreto",
        )
        Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.psico,
            duracion_segundos=90,
            estado=Sesion.Estado.COMPLETADO,
        )
        Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.psico,
            estado=Sesion.Estado.ERROR,
        )
        RegistroConsumoIA.objects.create(
            user=self.psico,
            servicio=RegistroConsumoIA.Servicio.CHAT_CLINICO,
            modelo="deepseek-chat",
            tokens_total=120,
            costo_estimado_usd="0.004321",
        )
        PagoPlusPendiente.objects.create(mp_preapproval_id="pre_ficticio", estado_mp="authorized")
        self.client.force_authenticate(self.superuser)

    def tearDown(self):
        cache.clear()

    def test_endpoints_rechazan_quien_no_es_superuser(self):
        self.client.force_authenticate(self.psico)
        for path in (
            "/api/cuenta/admin/resumen/",
            "/api/cuenta/admin/usuarios/",
            "/api/cuenta/admin/usuarios/export/",
            f"/api/cuenta/admin/usuarios/{self.psico.id}/",
            "/api/cuenta/admin/ingresos/",
            "/api/cuenta/admin/uso/",
            "/api/cuenta/admin/embudo/",
        ):
            self.assertEqual(self.client.get(path).status_code, 403, path)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get("/api/cuenta/admin/resumen/").status_code, (401, 403))

    def test_superuser_no_sale_expirada_ni_entra_en_metricas(self):
        lista = self.client.get("/api/auth/users/list/")
        self.assertEqual(lista.status_code, 200)
        root = next(item for item in lista.data if item["id"] == self.superuser.id)
        self.assertEqual(root["suscripcion"]["estado_visible"], "exenta")
        self.assertEqual(root["suscripcion"]["estado"], "expirada")

        stats = self.client.get("/api/auth/users/stats/")
        self.assertEqual(stats.status_code, 200)
        self.assertEqual(stats.data["total_usuarios"], 1)
        self.assertEqual(stats.data["usuarios_activos_mes"], 1)
        self.assertEqual(stats.data["suscripciones_activas"], 1)
        self.assertNotIn(SECRETO, json.dumps(stats.data))

    def test_resumen_alertas_y_cache_sin_datos_clinicos(self):
        primero = self.client.get("/api/cuenta/admin/resumen/")
        self.assertEqual(primero.status_code, 200)
        self.assertEqual(primero.data["pagados_por_plan"]["plus"]["cuentas"], 1)
        self.assertEqual(primero.data["pagados_por_plan"]["plus"]["mrr_clp"], 9990)
        self.assertEqual(primero.data["activos"]["dias_7"], 1)
        self.assertEqual(primero.data["pagos_fallidos"], 0)
        self.assertEqual(primero.data["alertas"]["plus_sin_vincular"][0]["preapproval_id"], "pre_ficticio")
        self.assertEqual(primero.data["alertas"]["transcripciones_fallidas_24h"]["total"], 1)
        self.assertEqual(primero.data["por_origen"][0]["origen"], "google")
        texto = json.dumps(primero.data)
        self.assertNotIn(SECRETO, texto)
        self.assertNotIn("diagnostico secreto", texto)

        User.objects.create_user("otro", "otro@ejemplo.cl", _clave())
        cacheado = self.client.get("/api/cuenta/admin/resumen/")
        self.assertEqual(cacheado.data["registros"]["hoy"], primero.data["registros"]["hoy"])
        cache.clear()
        fresco = self.client.get("/api/cuenta/admin/resumen/")
        self.assertEqual(fresco.data["registros"]["hoy"], primero.data["registros"]["hoy"] + 1)

    def test_tabla_filtra_pagina_y_exporta_sin_nombres_de_pacientes(self):
        duplicado = User.objects.create_user("copia", "psico@ejemplo.cl", _clave())
        duplicado.perfil_psicologo.ultima_actividad = timezone.now() - timedelta(days=20)
        duplicado.perfil_psicologo.save()
        res = self.client.get("/api/cuenta/admin/usuarios/", {"q": "psico", "plan": "plus"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        fila = res.data["results"][0]
        self.assertTrue(fila["email_duplicado"])
        self.assertEqual(fila["audio_minutos_total"], 1.5)
        self.assertEqual(fila["sesiones_mes"], 2)
        self.assertEqual(fila["suscripcion"]["card_last_four"], "4242")
        self.assertNotIn(SECRETO, json.dumps(res.data))

        csv_res = self.client.get("/api/cuenta/admin/usuarios/export/", {"q": "psico"})
        self.assertEqual(csv_res.status_code, 200)
        self.assertIn("psico@ejemplo.cl", csv_res.content.decode())
        self.assertNotIn(SECRETO, csv_res.content.decode())

        inactivos = self.client.get("/api/cuenta/admin/usuarios/", {"inactivos": "1", "q": "copia"})
        self.assertEqual(inactivos.data["count"], 1)

    def test_detalle_solo_conteos_y_marca_interna(self):
        res = self.client.get(f"/api/cuenta/admin/usuarios/{self.psico.id}/")
        self.assertEqual(res.status_code, 200)
        texto = json.dumps(res.data)
        self.assertNotIn(SECRETO, texto)
        self.assertNotIn("diagnostico", texto)
        mes = res.data["uso_por_mes"][-1]
        self.assertEqual(mes["pacientes"], 1)
        self.assertEqual(mes["sesiones"], 2)
        self.assertEqual(mes["transcripciones_ok"], 1)
        self.assertEqual(mes["transcripciones_fallidas"], 1)
        self.assertEqual(res.data["costo_ia"]["total_usd"], 0.004321)
        self.assertEqual(res.data["costo_ia"]["pago_mensual_clp"], 9990)
        self.assertIsNotNone(res.data["hitos"]["primer_paciente"])
        self.assertTrue(res.data["pagos_mercadopago"]["tiene_preapproval"] is False)

        patch_res = self.client.patch(
            f"/api/cuenta/admin/usuarios/{self.psico.id}/",
            {"es_interna": True},
            format="json",
        )
        self.assertEqual(patch_res.status_code, 200)
        self.psico.perfil_psicologo.refresh_from_db()
        self.assertTrue(self.psico.perfil_psicologo.es_interna)
        cache.clear()
        resumen = self.client.get("/api/cuenta/admin/resumen/")
        self.assertEqual(resumen.data["pagados_por_plan"]["plus"]["cuentas"], 0)

    def test_ingresos_uso_y_embudo(self):
        ingresos = self.client.get("/api/cuenta/admin/ingresos/")
        self.assertEqual(ingresos.status_code, 200)
        self.assertEqual(ingresos.data["mrr_clp"], 9990)
        self.assertEqual(len(ingresos.data["proximos_cobros"]), 1)
        self.assertNotIn(SECRETO, json.dumps(ingresos.data))

        uso = self.client.get("/api/cuenta/admin/uso/")
        self.assertEqual(uso.data["top_usuarios"][0]["email"], "psico@ejemplo.cl")
        self.assertEqual(uso.data["por_servicio_mes"][0]["servicio"], "CHAT_CLINICO")

        embudo = self.client.get("/api/cuenta/admin/embudo/")
        actual = embudo.data["cohortes"][-1]
        self.assertGreaterEqual(actual["registros"], 1)
        self.assertGreaterEqual(actual["primer_paciente"], 1)
        self.assertGreaterEqual(actual["pago"], 1)
        origen = next(item for item in embudo.data["por_origen"] if item["origen"] == "google")
        self.assertEqual(origen["pagos"], 1)

    def test_crear_usuario_con_plan_y_dias(self):
        res = self.client.post(
            "/api/auth/users/",
            {
                "username": "nuevo",
                "password": _clave(),
                "email": "nuevo@ejemplo.cl",
                "first_name": "Nuevo",
                "plan": "plus",
                "dias_prueba": 7,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        creado = User.objects.get(username="nuevo")
        self.assertEqual(creado.suscripcion.plan, "plus")
        self.assertEqual(creado.suscripcion.estado, "trial")
        self.assertGreater(creado.suscripcion.fin_prueba, timezone.now() + timedelta(days=6))

    @patch("cuentas.services.secrets.randbelow", return_value=888999)
    def test_registro_guarda_origen_y_los_viejos_quedan_desconocido(self, _rand):
        self.assertEqual(self.interna.perfil_psicologo.origen, "desconocido")
        alta = self.client.post(
            "/api/auth/register/",
            {
                "first_name": "Lia",
                "last_name": "Rojas",
                "email": "lia@ejemplo.cl",
                "password": _clave(),
            },
            format="json",
        )
        self.assertEqual(alta.status_code, 200, alta.data)
        self.client.force_authenticate(None)
        verify = self.client.post(
            "/api/auth/register/verify/",
            {
                "email": "lia@ejemplo.cl",
                "code": "888999",
                "utm_source": "meta",
                "utm_medium": "cpc",
                "utm_campaign": "marzo",
                "fbclid": "fb123",
            },
            format="json",
        )
        self.assertEqual(verify.status_code, 201, verify.data)
        perfil = PerfilPsicologo.objects.get(user__email="lia@ejemplo.cl")
        self.assertEqual(perfil.origen, "meta")
        self.assertEqual(perfil.utm_medium, "cpc")
        self.assertEqual(perfil.fbclid, "fb123")
        self.assertIsNotNone(perfil.user.last_login)
