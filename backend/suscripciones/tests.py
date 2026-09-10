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
