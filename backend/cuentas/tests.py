from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

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

        # 4. Check current_user endpoint has trial days
        token = res_login.data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res_me = client.get("/api/auth/me/")
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.data["suscripcion_estado"], "trial")
        self.assertEqual(res_me.data["dias_restantes_prueba"], 14)
