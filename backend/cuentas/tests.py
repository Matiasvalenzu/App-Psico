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
