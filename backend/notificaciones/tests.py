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
from sesiones import tasks as sesiones_tasks
from sesiones.models import Sesion

from .models import NotificacionEmail
from .services import (
    enqueue_booking_confirmations,
    enqueue_session_ready_email,
    enqueue_welcome_email,
)
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


@override_settings(**EMAIL_TEST_SETTINGS)
class SessionReadyEmailTests(TestCase):
    """Aviso "Tu sesión está lista": sin datos clínicos, sin duplicados, sin romper el flujo."""

    PATIENT_FIRST = "Zulema"
    PATIENT_LAST = "Ficticiaperez"

    def setUp(self):
        self.psychologist = get_user_model().objects.create_user(
            username="psicologa-sl",
            email="psicologa-sl@example.com",
            first_name="Ana",
            last_name="Rojas",
        )
        self.patient = Paciente.objects.create(
            psicologo=self.psychologist,
            nombre=self.PATIENT_FIRST,
            apellido=self.PATIENT_LAST,
            email_contacto="paciente-ficticio@example.com",
        )
        self.sesion = Sesion.objects.create(
            paciente=self.patient,
            psicologo=self.psychologist,
            audio_path="/tmp/audio-ficticio.wav",
            notas_sesion="NOTA-CLINICA-RESERVADA",
        )

    def _run_pipeline(self, *, whisper_error=None):
        patches = [
            patch.object(
                sesiones_tasks,
                "_run_whisper",
                side_effect=whisper_error,
                return_value=[],
            ),
            patch.object(sesiones_tasks, "_run_diarization", return_value=[]),
            patch.object(sesiones_tasks, "_build_speaker_map", return_value=({}, [])),
            patch.object(sesiones_tasks, "_merge_transcription_segments", return_value=[]),
            patch("notificaciones.tasks.send_notification.delay"),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def _send_pending(self):
        results = [
            send_notification(pk)
            for pk in NotificacionEmail.objects.filter(
                tipo=NotificacionEmail.Tipo.SESION_LISTA
            ).values_list("pk", flat=True)
        ]
        return results

    @patch("notificaciones.tasks.send_notification.delay")
    def test_sends_one_email_without_patient_data_and_with_correct_link(self, delay):
        with self.captureOnCommitCallbacks(execute=True):
            notification = enqueue_session_ready_email(self.sesion)
        delay.assert_called_once_with(notification.pk)
        self.assertEqual(notification.clave_deduplicacion, f"sesion_lista:{self.sesion.pk}")
        self.assertEqual(notification.destinatario, "psicologa-sl@example.com")

        self.assertEqual(send_notification(notification.pk), "sent")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, "Tu sesión está lista en Psiconex")
        self.assertEqual(message.to, ["psicologa-sl@example.com"])
        expected_url = (
            f"https://app.psiconex.cl/dashboard/pacientes/{self.patient.pk}"
            f"/sesiones/{self.sesion.pk}"
        )
        html = message.alternatives[0][0]
        self.assertIn(expected_url, message.body)
        self.assertIn(expected_url, html)
        self.assertIn("cid:psiconex-logo", html)
        for forbidden in (
            self.PATIENT_FIRST,
            self.PATIENT_LAST,
            "paciente-ficticio@example.com",
            "NOTA-CLINICA-RESERVADA",
        ):
            for part in (message.subject, message.body, html):
                self.assertNotIn(forbidden, part)

    @patch("notificaciones.tasks.send_notification.delay")
    def test_enqueue_is_deduplicated(self, delay):
        with self.captureOnCommitCallbacks(execute=True):
            first = enqueue_session_ready_email(self.sesion)
            second = enqueue_session_ready_email(self.sesion)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(
            NotificacionEmail.objects.filter(
                tipo=NotificacionEmail.Tipo.SESION_LISTA
            ).count(),
            1,
        )
        delay.assert_called_once_with(first.pk)
        send_notification(first.pk)
        self.assertEqual(send_notification(first.pk), "already-sent")
        self.assertEqual(len(mail.outbox), 1)

    def test_completed_pipeline_queues_email_and_retry_does_not_duplicate(self):
        self._run_pipeline()
        self.assertTrue(sesiones_tasks.procesar_audio_sesion.run(self.sesion.pk))
        self.assertTrue(sesiones_tasks.procesar_audio_sesion.run(self.sesion.pk))
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado, Sesion.Estado.COMPLETADO)
        self.assertEqual(
            NotificacionEmail.objects.filter(
                tipo=NotificacionEmail.Tipo.SESION_LISTA
            ).count(),
            1,
        )
        self.assertEqual(self._send_pending(), ["sent"])
        self.assertEqual(len(mail.outbox), 1)

    def test_error_state_does_not_send(self):
        self._run_pipeline(whisper_error=RuntimeError("fallo simulado"))
        with self.assertRaises(Exception):
            sesiones_tasks.procesar_audio_sesion.run(self.sesion.pk)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado, Sesion.Estado.ERROR)
        self.assertFalse(
            NotificacionEmail.objects.filter(
                tipo=NotificacionEmail.Tipo.SESION_LISTA
            ).exists()
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_enqueue_failure_does_not_break_transcription(self):
        self._run_pipeline()
        with patch(
            "notificaciones.services.enqueue_session_ready_email",
            side_effect=RuntimeError("cola caída"),
        ), self.assertLogs(sesiones_tasks.logger, level="ERROR"):
            result = sesiones_tasks.procesar_audio_sesion.run(self.sesion.pk)
        self.assertTrue(result)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado, Sesion.Estado.COMPLETADO)

    def test_email_send_failure_does_not_break_transcription(self):
        self._run_pipeline()
        with patch(
            "notificaciones.tasks.send_branded_email",
            side_effect=ConnectionError("smtp caído"),
        ):
            self.assertTrue(sesiones_tasks.procesar_audio_sesion.run(self.sesion.pk))
            notification = NotificacionEmail.objects.get(
                tipo=NotificacionEmail.Tipo.SESION_LISTA
            )
            with self.assertLogs("notificaciones.tasks", level="ERROR"):
                try:
                    send_notification.run(notification.pk)
                except Exception:
                    pass  # el reintento de Celery es el comportamiento esperado
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado, Sesion.Estado.COMPLETADO)
        notification.refresh_from_db()
        self.assertEqual(notification.estado, NotificacionEmail.Estado.ERROR)
        self.assertEqual(len(mail.outbox), 0)

    def test_uses_verified_notification_email_when_available(self):
        from django.utils import timezone as tz

        from cuentas.services import get_or_create_profile

        profile = get_or_create_profile(self.psychologist)
        profile.email_notificaciones = "avisos@example.com"
        profile.email_notificaciones_verificado_at = tz.now()
        profile.save()
        notification = enqueue_session_ready_email(self.sesion)
        self.assertEqual(notification.destinatario, "avisos@example.com")

    def test_no_recipient_means_no_notification(self):
        no_email_user = get_user_model().objects.create_user(
            username="sin-correo", email=""
        )
        sesion = Sesion.objects.create(
            paciente=self.patient, psicologo=no_email_user, audio_path="/tmp/a.wav"
        )
        self.assertIsNone(enqueue_session_ready_email(sesion))
        self.assertEqual(NotificacionEmail.objects.count(), 0)


@override_settings(**EMAIL_TEST_SETTINGS)
class AppointmentReminderTests(TestCase):
    """Recordatorio 24 h antes: uno por cita e inicio, respeta anulaciones y el toggle."""

    def setUp(self):
        self.psychologist = get_user_model().objects.create_user(
            username="psicologa-rec",
            email="psicologa-rec@example.com",
            first_name="Ana",
            last_name="Rojas",
        )
        self.patient = Paciente.objects.create(
            psicologo=self.psychologist,
            nombre="María",
            apellido="Pérez",
            email_contacto="maria-rec@example.com",
            notas_privadas="NOTA-CLINICA-RESERVADA",
        )
        start = timezone.now() + timedelta(hours=24)
        self.cita = AgendaCita.objects.create(
            psicologo=self.psychologist,
            paciente=self.patient,
            inicio=start,
            fin=start + timedelta(minutes=50),
            estado=AgendaCita.Estado.CONFIRMADA,
        )

    def _enqueue(self):
        from .services import enqueue_appointment_reminders

        with patch("notificaciones.tasks.send_notification.delay"):
            with self.captureOnCommitCallbacks(execute=True):
                return enqueue_appointment_reminders()

    def _reminders(self):
        return NotificacionEmail.objects.filter(tipo=NotificacionEmail.Tipo.RECORDATORIO_CITA)

    def test_one_reminder_without_clinical_data(self):
        self.assertEqual(self._enqueue(), 1)
        self.assertEqual(self._enqueue(), 0)
        notification = self._reminders().get()
        self.assertEqual(notification.destinatario, "maria-rec@example.com")
        self.assertEqual(notification.responder_a, "psicologa-rec@example.com")

        self.assertEqual(send_notification(notification.pk), "sent")
        message = mail.outbox[0]
        self.assertIn("es mañana", message.subject)
        self.assertIn("María", message.body)
        self.assertNotIn("NOTA-CLINICA-RESERVADA", message.body)
        self.assertIn("responde este correo", message.body)

    def test_cancelled_appointment_gets_no_reminder(self):
        self.cita.estado = AgendaCita.Estado.ANULADA
        self.cita.save()
        self.assertEqual(self._enqueue(), 0)

    def test_appointment_outside_window_gets_no_reminder(self):
        self.cita.inicio = timezone.now() + timedelta(hours=30)
        self.cita.fin = self.cita.inicio + timedelta(minutes=50)
        self.cita.save()
        self.assertEqual(self._enqueue(), 0)

    def test_rescheduled_appointment_gets_new_reminder(self):
        self._enqueue()
        first = self._reminders().get()
        self.cita.inicio += timedelta(minutes=30)
        self.cita.fin += timedelta(minutes=30)
        self.cita.save()

        self.assertEqual(self._enqueue(), 1)
        self.assertEqual(send_notification(first.pk), "skipped")
        first.refresh_from_db()
        self.assertEqual(first.estado, NotificacionEmail.Estado.OMITIDA)
        self.assertEqual(len(mail.outbox), 0)

    def test_disabled_toggle_gets_no_reminder(self):
        perfil = self.psychologist.perfil_psicologo
        perfil.recordatorios_paciente_activos = False
        perfil.save()
        self.assertEqual(self._enqueue(), 0)

    def test_cancelled_after_enqueue_is_skipped(self):
        self._enqueue()
        notification = self._reminders().get()
        self.cita.estado = AgendaCita.Estado.ANULADA
        self.cita.save()
        self.assertEqual(send_notification(notification.pk), "skipped")
        self.assertEqual(len(mail.outbox), 0)

    def test_toggle_is_exposed_in_profile(self):
        client = APIClient()
        client.force_authenticate(self.psychologist)
        response = client.get("/api/cuenta/perfil/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["recordatorios_paciente_activos"])
        response = client.patch(
            "/api/cuenta/perfil/", {"recordatorios_paciente_activos": False}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.psychologist.perfil_psicologo.refresh_from_db()
        self.assertFalse(self.psychologist.perfil_psicologo.recordatorios_paciente_activos)
