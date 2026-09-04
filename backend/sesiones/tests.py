from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from pacientes.models import Paciente
from sesiones.models import Sesion
from agenda.google_calendar import GoogleCalendarError

User = get_user_model()


class GoogleMeetRemoteSessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="psicologo_test",
            email="psicologo@test.com",
            password="testpassword123",
            first_name="Carlos",
            last_name="Psicólogo",
        )
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(
            psicologo=self.user,
            nombre="Juan",
            apellido="Pérez",
            email_contacto="juan.perez@test.com",
            telefono_whatsapp="+56912345678",
        )

    def test_google_meet_status(self):
        with patch("agenda.google_calendar.get_connection_status") as mock_status:
            mock_status.return_value = {"configured": True, "connected": True}
            res = self.client.get("/api/sesiones/google_meet_status/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertTrue(res.data["connected"])

    def test_generar_meet_not_connected(self):
        with patch(
            "agenda.google_calendar.create_meet_conference",
            side_effect=GoogleCalendarError("No conectado"),
        ):
            res = self.client.post(
                "/api/sesiones/generar_meet/",
                {"paciente": self.paciente.id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("error", res.data)

    def test_generar_meet_success(self):
        with patch("agenda.google_calendar.create_meet_conference") as mock_create:
            mock_create.return_value = {
                "meet_url": "https://meet.google.com/abc-defg-hij",
                "event_id": "event_123",
                "calendar_id": "cal_123",
            }
            res = self.client.post(
                "/api/sesiones/generar_meet/",
                {"paciente": self.paciente.id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["meet_url"], "https://meet.google.com/abc-defg-hij")

    def test_crear_virtual_session(self):
        res = self.client.post(
            "/api/sesiones/crear_virtual/",
            {
                "paciente": self.paciente.id,
                "plataforma": "GOOGLE_MEET",
                "url_reunion": "https://meet.google.com/abc-defg-hij",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["origen"], "VIRTUAL")
        self.assertEqual(res.data["url_reunion"], "https://meet.google.com/abc-defg-hij")

    def test_enviar_enlace_paciente(self):
        sesion = Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.user,
            origen=Sesion.Origen.VIRTUAL,
            plataforma_virtual=Sesion.Plataforma.GOOGLE_MEET,
            url_reunion="https://meet.google.com/abc-defg-hij",
            estado=Sesion.Estado.PENDIENTE,
        )
        with patch("notificaciones.services.send_meet_invitation_to_patient") as mock_send:
            res = self.client.post(f"/api/sesiones/{sesion.id}/enviar_enlace_paciente/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertTrue(res.data["success"])
            mock_send.assert_called_once()
