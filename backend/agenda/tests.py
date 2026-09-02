from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from datetime import time

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import google_calendar
from pacientes.models import Paciente

from .models import (
    AgendaCita,
    AgendaDisponibilidad,
    AgendaGoogleCalendarConnection,
    AgendaPerfilPublico,
    AgendaReservaEvento,
    AgendaReservaPublica,
    AgendaVerificacionReserva,
)


class GoogleResponse:
    def __init__(self, data, status_code=200):
        self._data = data
        self.status_code = status_code
        self.ok = status_code < 400
        self.content = b"{}"
        self.text = ""

    def json(self):
        return self._data


class GoogleCalendarIsolationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="psicologo", password="test-password"
        )

    def test_existing_broad_scope_requires_reauthorization(self):
        AgendaGoogleCalendarConnection.objects.create(
            psicologo=self.user,
            refresh_token="old-refresh-token",
            scope="https://www.googleapis.com/auth/calendar",
        )

        status = google_calendar.get_connection_status(self.user)

        self.assertFalse(status["connected"])
        self.assertTrue(status["requires_reauthorization"])

    @patch("agenda.google_calendar.requests.request")
    def test_sync_creates_and_writes_only_to_dedicated_calendar(self, request):
        connection = AgendaGoogleCalendarConnection.objects.create(
            psicologo=self.user,
            access_token="access-token",
            refresh_token="refresh-token",
            scope=google_calendar.GOOGLE_SCOPE,
            token_expires_at=timezone.now() + timedelta(hours=1),
        )
        cita = AgendaCita.objects.create(
            psicologo=self.user,
            prospecto_nombre="Paciente",
            prospecto_apellido="Prueba",
            inicio=timezone.now() + timedelta(days=1),
            fin=timezone.now() + timedelta(days=1, hours=1),
        )
        google_only_data = "contenido-procedente-de-google"
        request.side_effect = [
            GoogleResponse({"id": "dedicated-calendar-id", "summary": google_only_data}),
            GoogleResponse({"id": "dedicated-event-id", "summary": google_only_data}),
        ]

        result = google_calendar.sync_app_to_google(self.user)

        self.assertEqual(result, {"connected": True, "synced": 1, "failed": 0})
        self.assertEqual(request.call_count, 2)
        self.assertEqual(
            [call.args[0] for call in request.call_args_list],
            ["POST", "POST"],
        )
        self.assertEqual(
            [call.args[1] for call in request.call_args_list],
            [
                f"{google_calendar.GOOGLE_CALENDAR_API}/calendars",
                f"{google_calendar.GOOGLE_CALENDAR_API}/calendars/dedicated-calendar-id/events",
            ],
        )

        connection.refresh_from_db()
        cita.refresh_from_db()
        self.assertEqual(connection.calendar_id, "dedicated-calendar-id")
        self.assertIsNotNone(connection.last_synced_at)
        self.assertEqual(cita.google_event_id, "dedicated-event-id")
        self.assertNotIn(google_only_data, connection.calendar_id)
        self.assertNotIn(google_only_data, cita.google_event_id)
        self.assertNotIn(google_only_data, cita.prospecto_nombre)
        self.assertNotIn(google_only_data, cita.notas)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PUBLIC_APP_URL="http://testserver",
)
class PublicBookingManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="profesional",
            email="profesional@example.com",
            password="test-password",
        )
        self.profile = AgendaPerfilPublico.objects.create(
            psicologo=self.user,
            slug="profesional",
            nombre_publico="Profesional Prueba",
            anticipacion_minima_horas=0,
            anticipacion_cambios_horas=0,
            ventana_reserva_dias=30,
        )
        for weekday in range(7):
            AgendaDisponibilidad.objects.create(
                psicologo=self.user,
                dia_semana=weekday,
                hora_inicio=time(9),
                hora_fin=time(18),
            )
        self.patient = Paciente.objects.create(
            psicologo=self.user,
            nombre="Paciente",
            apellido="Existente",
            tipo_documento="PASAPORTE",
            numero_documento="AB-123456",
            documento_normalizado="AB123456",
            email_contacto="paciente@example.com",
        )

    def _slot(self, days_from_now):
        day = timezone.localdate() + timedelta(days=days_from_now)
        response = self.client.get(
            f"/api/agenda/publica/{self.profile.slug}/slots/",
            {"desde": day.isoformat(), "hasta": day.isoformat()},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["slots"])
        return response.data["slots"][0]["inicio"]

    @patch("agenda.public_booking.secrets.randbelow", return_value=123456)
    def test_verified_patient_can_book_reschedule_and_cancel(self, _randbelow):
        otp_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/solicitar-otp/",
            {
                "tipo_paciente": "EXISTENTE",
                "tipo_documento": "PASAPORTE",
                "numero_documento": "AB-123456",
                "email": "atacante@example.com",
            },
            format="json",
        )
        self.assertEqual(otp_response.status_code, 201)
        self.assertEqual(mail.outbox[-1].to, ["paciente@example.com"])
        self.assertNotIn("atacante@example.com", mail.outbox[-1].to)

        invalid_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/confirmar-otp/",
            {
                "verificacion_id": otp_response.data["verificacion_id"],
                "codigo": "000000",
            },
            format="json",
        )
        self.assertEqual(invalid_response.status_code, 400)
        self.assertEqual(
            AgendaVerificacionReserva.objects.get(
                public_id=otp_response.data["verificacion_id"]
            ).intentos,
            1,
        )

        verification_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/confirmar-otp/",
            {
                "verificacion_id": otp_response.data["verificacion_id"],
                "codigo": "123456",
            },
            format="json",
        )
        self.assertEqual(verification_response.status_code, 200)

        booking_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/reservar/",
            {
                "tipo_paciente": "EXISTENTE",
                "tipo_documento": "PASAPORTE",
                "numero_documento": "AB-123456",
                "verification_token": verification_response.data["verification_token"],
                "inicio": self._slot(2),
            },
            format="json",
        )
        self.assertEqual(booking_response.status_code, 201)
        self.assertNotIn("id", booking_response.data["reserva"])
        booking_code = booking_response.data["reserva"]["codigo"]
        self.assertRegex(booking_code, r"^PSX-(?:[A-Z2-7]{4}-){3}[A-Z2-7]{4}$")

        identification_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/gestion/identificar/",
            {
                "codigo_reserva": booking_code.lower(),
                "tipo_documento": "PASAPORTE",
                "numero_documento": "AB-123456",
            },
            format="json",
        )
        self.assertEqual(identification_response.status_code, 200)
        token = identification_response.data["token"]

        reschedule_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/gestion/reprogramar/",
            {
                "token": token,
                "inicio": self._slot(3),
                "version": 1,
                "request_id": "reschedule-test",
            },
            format="json",
        )
        self.assertEqual(reschedule_response.status_code, 200)
        self.assertEqual(reschedule_response.data["reserva"]["version"], 2)
        self.assertEqual(reschedule_response.data["reserva"]["codigo_reserva"], booking_code)

        cancel_response = self.client.post(
            f"/api/agenda/publica/{self.profile.slug}/gestion/cancelar/",
            {
                "token": token,
                "version": 2,
                "request_id": "cancel-test",
            },
            format="json",
        )
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.data["reserva"]["estado"], "ANULADA")
        self.assertEqual(cancel_response.data["reserva"]["codigo_reserva"], booking_code)

        reservation = AgendaReservaPublica.objects.get(codigo_reserva=booking_code)
        self.assertEqual(reservation.paciente, self.patient)
        self.assertEqual(reservation.email_confirmacion, "paciente@example.com")
        self.assertEqual(
            list(reservation.eventos.values_list("tipo", flat=True)),
            [
                AgendaReservaEvento.Tipo.CREADA,
                AgendaReservaEvento.Tipo.REPROGRAMADA,
                AgendaReservaEvento.Tipo.CANCELADA,
            ],
        )
