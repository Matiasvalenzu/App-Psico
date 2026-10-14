from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from .models import PagoPlusPendiente, Suscripcion
from .tasks import avisar_pago_plus_sin_vincular

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


class PlanPlusTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="plus@psiconex.cl", email="plus@psiconex.cl", password="x")
        self.client.force_authenticate(user=self.user)

    def test_trial_estandar_sin_boletas(self):
        response = self.client.get("/api/auth/me/", secure=True)
        self.assertEqual(response.data["plan"], "estandar")
        self.assertFalse(response.data["boletas_habilitadas"])
        self.assertFalse(response.data["plan_plus_disponible"])
        self.assertFalse(response.data["tiene_cobros"])

    def test_tiene_cobros_aunque_sin_plus(self):
        from facturacion.models import Cobro

        Cobro.objects.create(
            psicologo=self.user, fecha_pago="2026-10-12", monto_bruto=10000,
            tasa_retencion="15.25", monto_retencion=1525, monto_liquido=8475,
        )
        data = self.client.get("/api/auth/me/", secure=True).data
        self.assertTrue(data["tiene_cobros"])
        self.assertFalse(data["boletas_habilitadas"])

    def test_trial_plus_no_habilita_boletas(self):
        self.user.suscripcion.plan = "plus"
        self.user.suscripcion.estado = "trial"
        self.user.suscripcion.save()
        self.assertFalse(self.client.get("/api/auth/me/", secure=True).data["boletas_habilitadas"])

    def test_plus_vigente_habilita_boletas(self):
        self.user.suscripcion.plan = "plus"
        self.user.suscripcion.estado = "activa"
        self.user.suscripcion.save()
        self.assertTrue(self.client.get("/api/auth/me/", secure=True).data["boletas_habilitadas"])
        self.user.suscripcion.estado = "expirada"
        self.user.suscripcion.save()
        self.assertFalse(self.client.get("/api/auth/me/", secure=True).data["boletas_habilitadas"])

    def test_contratar_plus_bloqueado_sin_flag(self):
        response = self.client.post(
            "/api/suscripciones/contratar/", {"token": "tok", "plan": "plus"}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("suscripciones.views._get_mp_sdk")
    def test_contratar_plus_con_flag_cobra_9990(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().create.return_value = {"status": 201, "response": {"id": "pre_1", "payer_id": 1}}
        with self.settings(PLAN_PLUS_DISPONIBLE=True):
            response = self.client.post(
                "/api/suscripciones/contratar/", {"token": "tok", "plan": "plus"}, format="json", secure=True
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        datos = mock_sdk.preapproval().create.call_args[0][0]
        self.assertEqual(datos["auto_recurring"]["transaction_amount"], 9990)
        self.assertEqual(datos["reason"], "Plan Plus - Psiconex")
        self.assertEqual(datos.get("preapproval_plan_id", ""), settings.MERCADOPAGO_PLUS_PLAN_ID)
        fin = self.user.suscripcion.fin_prueba.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        self.assertNotEqual(datos["auto_recurring"]["start_date"], fin)
        self.user.suscripcion.refresh_from_db()
        self.assertEqual(self.user.suscripcion.plan, "plus")
        self.assertEqual(self.user.suscripcion.estado, "activa")

    def test_admin_asigna_plus(self):
        admin = User.objects.create_superuser(username="Admin", email="admin@psiconex.cl", password="x")
        self.client.force_authenticate(user=admin)
        response = self.client.patch(
            f"/api/auth/users/{self.user.id}/subscription/", {"plan": "plus"}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["suscripcion"]["plan"], "plus")
        self.assertEqual(
            self.client.patch(f"/api/auth/users/{self.user.id}/subscription/", {"plan": "oro"}, format="json", secure=True).status_code,
            400,
        )

    def _activa(self, plan="estandar"):
        s = self.user.suscripcion
        s.estado, s.plan, s.mp_preapproval_id = "activa", plan, "pre_9"
        s.save()

    @patch("suscripciones.views._get_mp_sdk")
    def test_cambiar_plan_actualiza_preapproval(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().update.return_value = {"status": 200, "response": {}}
        self._activa()
        with self.settings(PLAN_PLUS_DISPONIBLE=True):
            response = self.client.post("/api/suscripciones/cambiar-plan/", {"plan": "plus"}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        mp_id, datos = mock_sdk.preapproval().update.call_args[0]
        self.assertEqual(mp_id, "pre_9")
        self.assertEqual(datos["auto_recurring"]["transaction_amount"], 9990)
        mock_sdk.preapproval().create.assert_not_called()
        self.user.suscripcion.refresh_from_db()
        self.assertEqual(self.user.suscripcion.plan, "plus")

    @patch("suscripciones.views._get_mp_sdk")
    def test_cambiar_plan_error_mp_no_cambia(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().update.return_value = {"status": 400, "response": {"message": "bad"}}
        self._activa("plus")
        response = self.client.post("/api/suscripciones/cambiar-plan/", {"plan": "estandar"}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.user.suscripcion.refresh_from_db()
        self.assertEqual(self.user.suscripcion.plan, "plus")

    @patch("suscripciones.views._get_mp_sdk")
    def test_contratar_plus_cancela_estandar_y_no_cobra_dos(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().create.return_value = {"status": 201, "response": {"id": "pre_plus", "payer_id": 1}}
        mock_sdk.preapproval().update.return_value = {"status": 200, "response": {}}
        self._activa()
        with self.settings(PLAN_PLUS_DISPONIBLE=True, MERCADOPAGO_PLUS_PLAN_ID="3dc6b33c774d430d8960bca570457490"):
            response = self.client.post(
                "/api/suscripciones/contratar/", {"token": "tok", "plan": "plus"}, format="json", secure=True
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        datos = mock_sdk.preapproval().create.call_args[0][0]
        self.assertEqual(datos["preapproval_plan_id"], "3dc6b33c774d430d8960bca570457490")
        self.assertEqual(datos["auto_recurring"]["transaction_amount"], 9990)
        mock_sdk.preapproval().update.assert_called_with("pre_9", {"status": "cancelled"})
        self.assertEqual(mock_sdk.preapproval().create.call_count, 1)
        self.user.suscripcion.refresh_from_db()
        self.assertEqual(self.user.suscripcion.plan, "plus")
        self.assertEqual(self.user.suscripcion.mp_preapproval_id, "pre_plus")

    def test_cambiar_plan_sin_suscripcion_o_sin_flag(self):
        with self.settings(PLAN_PLUS_DISPONIBLE=True):
            response = self.client.post("/api/suscripciones/cambiar-plan/", {"plan": "plus"}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "sin_suscripcion")
        self._activa()
        response = self.client.post("/api/suscripciones/cambiar-plan/", {"plan": "plus"}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("suscripciones.views._get_mp_sdk")
    def test_piloto_plus_conserva_plan_al_contratar_sin_flag(self, mock_sdk_fn):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        mock_sdk.preapproval().create.return_value = {"status": 201, "response": {"id": "pre_2", "payer_id": 1}}
        self.user.suscripcion.plan = "plus"
        self.user.suscripcion.save()
        response = self.client.post("/api/suscripciones/contratar/", {"token": "tok"}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(mock_sdk.preapproval().create.call_args[0][0]["auto_recurring"]["transaction_amount"], 4990)
        self.user.suscripcion.refresh_from_db()
        self.assertEqual(self.user.suscripcion.plan, "plus")


@override_settings(MERCADOPAGO_PLUS_PLAN_ID="planplus", MERCADOPAGO_PLUS_URL="https://mpago.la/plus")
class EnlacePlusTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="enlace@psiconex.cl", email="enlace@psiconex.cl", password="x")
        self.client.force_authenticate(user=self.user)
        self.suscripcion = self.user.suscripcion

    def _mp(self, mock_sdk_fn, **response):
        mock_sdk = MagicMock()
        mock_sdk_fn.return_value = mock_sdk
        datos = {"preapproval_plan_id": "planplus", "status": "authorized", "payer_id": 77,
                 "payment_method_id": "visa", "next_payment_date": "2026-11-13T10:00:00.000-04:00"}
        datos.update(response)
        mock_sdk.preapproval().get.return_value = {"status": 200, "response": datos}
        mock_sdk.preapproval().update.return_value = {"status": 200, "response": {}}
        return mock_sdk

    def _vincular(self, preapproval_id="prePlus1"):
        return self.client.post("/api/suscripciones/vincular/", {"preapproval_id": preapproval_id}, format="json", secure=True)

    def test_enlace_expuesto(self):
        self.assertEqual(self.client.get("/api/suscripciones/estado/", secure=True).data["plus_url"], "https://mpago.la/plus")
        self.assertEqual(self.client.get("/api/auth/me/", secure=True).data["plus_url"], "https://mpago.la/plus")

    @patch("suscripciones.views._get_mp_sdk")
    def test_vincular_deja_plus_activo(self, mock_sdk_fn):
        mock_sdk = self._mp(mock_sdk_fn)
        response = self._vincular()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        mock_sdk.preapproval().get.assert_called_with("prePlus1")
        self.suscripcion.refresh_from_db()
        self.assertEqual((self.suscripcion.plan, self.suscripcion.estado), ("plus", "activa"))
        self.assertEqual(self.suscripcion.mp_preapproval_id, "prePlus1")
        self.assertEqual(self.suscripcion.card_brand, "visa")
        self.assertIsNotNone(self.suscripcion.proximo_cobro)
        self.assertTrue(self.client.get("/api/auth/me/", secure=True).data["boletas_habilitadas"])

    @patch("suscripciones.views._get_mp_sdk")
    def test_vincular_rechaza_otro_plan(self, mock_sdk_fn):
        self._mp(mock_sdk_fn, preapproval_plan_id="estandar")
        self.assertEqual(self._vincular().status_code, status.HTTP_400_BAD_REQUEST)
        self.suscripcion.refresh_from_db()
        self.assertEqual((self.suscripcion.plan, self.suscripcion.mp_preapproval_id), ("estandar", None))

    @patch("suscripciones.views._get_mp_sdk")
    def test_vincular_rechaza_preapproval_de_otra_cuenta(self, mock_sdk_fn):
        mock_sdk = self._mp(mock_sdk_fn)
        otro = User.objects.create_user(username="otro@psiconex.cl", email="otro@psiconex.cl", password="x")
        Suscripcion.objects.filter(user=otro).update(mp_preapproval_id="prePlus1")
        self.assertEqual(self._vincular().status_code, status.HTTP_409_CONFLICT)
        mock_sdk.preapproval().get.assert_not_called()
        self.assertEqual(self._vincular("prePlus1; DROP").status_code, status.HTTP_400_BAD_REQUEST)

    @patch("suscripciones.views._get_mp_sdk")
    def test_vincular_cancela_el_estandar_que_pagaba(self, mock_sdk_fn):
        mock_sdk = self._mp(mock_sdk_fn)
        Suscripcion.objects.filter(pk=self.suscripcion.pk).update(estado="activa", mp_preapproval_id="preEstandar")
        self.assertEqual(self._vincular().status_code, status.HTTP_200_OK)
        mock_sdk.preapproval().update.assert_called_with("preEstandar", {"status": "cancelled"})

        # El aviso de cancelación del Estándar reemplazado no toca la suscripción Plus.
        mock_sdk.preapproval().get.return_value = {
            "status": 200, "response": {"external_reference": str(self.user.id), "status": "cancelled"},
        }
        self.client.post("/api/suscripciones/webhook/",
                         {"type": "subscription_preapproval", "data": {"id": "preEstandar"}}, format="json", secure=True)
        self.suscripcion.refresh_from_db()
        self.assertEqual((self.suscripcion.plan, self.suscripcion.estado, self.suscripcion.mp_preapproval_id),
                         ("plus", "activa", "prePlus1"))

    @patch("suscripciones.views._get_mp_sdk")
    def test_webhook_reconoce_preapproval_plus_vinculado(self, mock_sdk_fn):
        self._mp(mock_sdk_fn, status="paused")
        Suscripcion.objects.filter(pk=self.suscripcion.pk).update(estado="activa", plan="plus", mp_preapproval_id="prePlus1")
        self.client.post("/api/suscripciones/webhook/",
                         {"type": "subscription_preapproval", "data": {"id": "prePlus1"}}, format="json", secure=True)
        self.suscripcion.refresh_from_db()
        self.assertEqual((self.suscripcion.plan, self.suscripcion.estado), ("plus", "past_due"))

    @patch("suscripciones.tasks.avisar_pago_plus_sin_vincular.apply_async")
    @patch("suscripciones.views._get_mp_sdk")
    def test_webhook_deja_pendiente_el_pago_plus_sin_vincular(self, mock_sdk_fn, mock_aviso):
        self._mp(mock_sdk_fn)
        for _ in range(2):
            self.client.post("/api/suscripciones/webhook/",
                             {"type": "subscription_preapproval", "data": {"id": "prePlus9"}}, format="json", secure=True)
        self.assertFalse(Suscripcion.objects.filter(mp_preapproval_id="prePlus9").exists())
        pendiente = PagoPlusPendiente.objects.get(mp_preapproval_id="prePlus9")
        self.assertEqual(pendiente.estado_mp, "authorized")
        mock_aviso.assert_called_once_with(args=[pendiente.pk], countdown=1800)

        # Si vuelve después a /suscripcionok, el pago queda vinculado y no se avisa.
        self.assertEqual(self._vincular("prePlus9").status_code, status.HTTP_200_OK)
        pendiente.refresh_from_db()
        self.assertEqual(pendiente.vinculado_a, self.user)
        with patch("facturacion.bhe.send_mail") as mock_mail:
            avisar_pago_plus_sin_vincular(pendiente.pk)
        mock_mail.assert_not_called()

    @patch("suscripciones.tasks.avisar_pago_plus_sin_vincular.apply_async")
    @patch("suscripciones.views._get_mp_sdk")
    def test_webhook_no_deja_pendiente_otro_plan(self, mock_sdk_fn, mock_aviso):
        self._mp(mock_sdk_fn, preapproval_plan_id="otro")
        self.client.post("/api/suscripciones/webhook/",
                         {"type": "subscription_preapproval", "data": {"id": "preOtro"}}, format="json", secure=True)
        self.assertFalse(PagoPlusPendiente.objects.exists())
        mock_aviso.assert_not_called()

    def test_aviso_de_pago_plus_sin_vincular_a_los_admins(self):
        User.objects.create_superuser(username="jefe", email="jefe@psiconex.cl", password="x")
        pendiente = PagoPlusPendiente.objects.create(mp_preapproval_id="prePlus9", estado_mp="authorized")
        with patch("facturacion.bhe.send_mail") as mock_mail:
            avisar_pago_plus_sin_vincular(pendiente.pk)
        asunto, mensaje, _, correos = mock_mail.call_args.args
        self.assertIn("Plan Plus", asunto)
        self.assertIn("/suscripcionok?preapproval_id=prePlus9", mensaje)
        self.assertEqual(correos, ["jefe@psiconex.cl"])
