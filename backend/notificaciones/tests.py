from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from agenda.models import (
    AgendaCita,
    AgendaPerfilPublico,
    AgendaReservaPublica,
    AgendaVerificacionReserva,
)
from agenda.security import document_digest, sign_email_verification
from agenda.serializers import ReservaPublicaSerializer
from pacientes.models import Paciente

from .models import NotificacionEmail
from .services import enqueue_booking_confirmations, enqueue_welcome_email
from .tasks import send_notification


EMAIL_TEST_SETTINGS = {
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    "DEFAULT_FROM_EMAIL": "no-reply@datnexia.com",
    "EMAIL_FROM_NAME": "Psiconex",
    "EMAIL_SUPPORT_ADDRESS": "psiconex@datnexia.com",
    "EMAIL_LOGO_URL": "https://app.psiconex.cl/logo-psiconex.png",
    "PUBLIC_APP_URL": "https://app.psiconex.cl",
}


@override_settings(**EMAIL_TEST_SETTINGS)
class NotificationEmailTests(TestCase):
    def setUp(self):
        self.psychologist = get_user_model().objects.create_user(
            username="psicologa",
            email="psicologa@example.com",
            first_name="Ana",
            last_name="Rojas",
        )

    @patch("notificaciones.tasks.send_notification.delay")
    def test_welcome_is_deduplicated_and_branded(self, delay):
        with self.captureOnCommitCallbacks(execute=True):
            first = enqueue_welcome_email(self.psychologist)
            second = enqueue_welcome_email(self.psychologist)

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(
            NotificacionEmail.objects.filter(
                tipo=NotificacionEmail.Tipo.BIENVENIDA
            ).count(),
            1,
        )
        delay.assert_called_once_with(first.pk)

        self.assertEqual(send_notification(first.pk), "sent")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.from_email, "Psiconex <no-reply@datnexia.com>")
        self.assertEqual(message.reply_to, ["psiconex@datnexia.com"])
        self.assertIn("14 días", message.subject)
        self.assertIn("cid:psiconex-logo", message.alternatives[0][0])
        self.assertTrue(
            any(part.get("Content-ID") == "<psiconex-logo>" for part in message.attachments)
        )
        self.assertIn("Ana", message.body)

    @patch("notificaciones.tasks.send_notification.delay")
    def test_booking_creates_and_sends_both_notifications(self, delay):
        patient = Paciente.objects.create(
            psicologo=self.psychologist,
            nombre="María",
            apellido="Pérez",
            email_contacto="maria@example.com",
        )
        profile = AgendaPerfilPublico.objects.create(
            psicologo=self.psychologist,
            slug="ana-rojas",
            nombre_publico="Ps. Ana Rojas",
            instrucciones_reserva="La sesión se realizará por videollamada.",
        )
        start = timezone.now() + timedelta(days=2)
        appointment = AgendaCita.objects.create(
            psicologo=self.psychologist,
            paciente=patient,
            inicio=start,
            fin=start + timedelta(minutes=60),
            estado=AgendaCita.Estado.CONFIRMADA,
        )
        AgendaReservaPublica.objects.create(
            cita=appointment,
            paciente=patient,
            perfil=profile,
            tipo_paciente=AgendaReservaPublica.TipoPaciente.NUEVO,
        )

        with self.captureOnCommitCallbacks(execute=True):
            notifications = enqueue_booking_confirmations(
                appointment, "maria@example.com"
            )

        self.assertEqual(len(notifications), 2)
        self.assertEqual(delay.call_count, 2)
        for notification in notifications:
            self.assertEqual(send_notification(notification.pk), "sent")

        self.assertEqual(len(mail.outbox), 2)
        patient_mail = next(
            message for message in mail.outbox if message.to == ["maria@example.com"]
        )
        psychologist_mail = next(
            message
            for message in mail.outbox
            if message.to == ["psicologa@example.com"]
        )
        self.assertEqual(patient_mail.reply_to, ["psicologa@example.com"])
        self.assertEqual(psychologist_mail.reply_to, ["maria@example.com"])
        self.assertIn("La sesión se realizará", patient_mail.body)
        self.assertNotIn("motivo", patient_mail.body.lower())

    def test_public_booking_serializer_requires_verified_document(self):
        serializer = ReservaPublicaSerializer(
            data={
                "tipo_paciente": "EXISTENTE",
                "inicio": (timezone.now() + timedelta(days=1)).isoformat(),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("verification_token", serializer.errors)
        self.assertIn("tipo_documento", serializer.errors)
        self.assertIn("numero_documento", serializer.errors)


@override_settings(**EMAIL_TEST_SETTINGS, GOOGLE_CLIENT_ID="google-client-id")
class NotificationFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("notificaciones.tasks.send_notification.delay")
    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_registration_enqueues_welcome_once(self, verify_token, delay):
        verify_token.return_value = {
            "email": "new.psychologist@example.com",
            "email_verified": True,
            "given_name": "Camila",
            "family_name": "Soto",
        }

        with self.captureOnCommitCallbacks(execute=True):
            first_response = self.client.post(
                "/api/auth/google/login/", {"credential": "valid-token"}, format="json"
            )
        with self.captureOnCommitCallbacks(execute=True):
            second_response = self.client.post(
                "/api/auth/google/login/", {"credential": "valid-token"}, format="json"
            )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(
            NotificacionEmail.objects.filter(
                tipo=NotificacionEmail.Tipo.BIENVENIDA
            ).count(),
            1,
        )
        delay.assert_called_once()

    @patch("notificaciones.tasks.send_notification.delay")
    @patch("agenda.views.sync_appointment_to_google.delay")
    @patch("agenda.views.calcular_slots")
    def test_public_booking_enqueues_patient_and_psychologist_email(
        self, calculate_slots, sync_google, delay
    ):
        psychologist = get_user_model().objects.create_user(
            username="psicologo-reservas",
            email="profesional@example.com",
            first_name="Diego",
            last_name="Silva",
        )
        profile = AgendaPerfilPublico.objects.create(
            psicologo=psychologist,
            slug="diego-silva",
            nombre_publico="Ps. Diego Silva",
            instrucciones_reserva="Atención presencial, oficina 305.",
        )
        start = timezone.localtime(timezone.now() + timedelta(days=2)).replace(
            minute=0, second=0, microsecond=0
        )
        calculate_slots.return_value = [
            {
                "inicio": start.isoformat(),
                "fin": (start + timedelta(hours=1)).isoformat(),
            }
        ]
        verification = AgendaVerificacionReserva.objects.create(
            perfil=profile,
            tipo_paciente=AgendaReservaPublica.TipoPaciente.NUEVO,
            tipo_documento="PASAPORTE",
            documento_digest=document_digest(profile.pk, "PASAPORTE", "LAURA123"),
            email="laura@example.com",
            codigo_hash="used-in-previous-step",
            expira_at=timezone.now() + timedelta(minutes=10),
            verificada_at=timezone.now(),
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/agenda/publica/diego-silva/reservar/",
                {
                    "tipo_paciente": "NUEVO",
                    "tipo_documento": "PASAPORTE",
                    "numero_documento": "LAURA-123",
                    "verification_token": sign_email_verification(verification.public_id),
                    "inicio": start.isoformat(),
                    "nombre_completo": "Laura Méndez",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            set(
                NotificacionEmail.objects.filter(cita__isnull=False).values_list(
                    "destinatario", flat=True
                )
            ),
            {"laura@example.com", "profesional@example.com"},
        )
        self.assertEqual(delay.call_count, 2)
        sync_google.assert_called_once()
