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
