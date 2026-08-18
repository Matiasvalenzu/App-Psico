from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from . import google_calendar
from .models import AgendaCita, AgendaGoogleCalendarConnection


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
