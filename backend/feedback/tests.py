from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import FeedbackReport

User = get_user_model()


class FeedbackTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="psicologo_test",
            email="psicologo@test.com",
            password="testpassword123",
            first_name="Juan",
            last_name="Perez",
        )
        self.admin = User.objects.create_superuser(
            username="admin_test",
            email="admin@test.com",
            password="adminpassword123",
        )

    def test_crear_feedback(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "tipo": "error",
            "modulo": "agenda",
            "severidad": "alta",
            "titulo": "Problema al agendar cita",
            "descripcion": "El selector de horas no permite guardar.",
            "pasos_reproducir": "1. Seleccionar hora 10:00. 2. Clic guardar.",
            "url_origen": "https://app.psiconex.cl/dashboard/agenda",
        }
        response = self.client.post("/api/feedback/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FeedbackReport.objects.count(), 1)
        reporte = FeedbackReport.objects.first()
        self.assertEqual(reporte.usuario, self.user)
        self.assertEqual(reporte.estado, "nuevo")

    def test_mis_reportes(self):
        FeedbackReport.objects.create(
            usuario=self.user,
            tipo="mejora",
            modulo="tests",
            titulo="Más tests diagnósticos",
            descripcion="Agregar test de Beck.",
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/feedback/mis-reportes/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["titulo"], "Más tests diagnósticos")

    def test_admin_update_reporte(self):
        reporte = FeedbackReport.objects.create(
            usuario=self.user,
            tipo="error",
            modulo="general",
            titulo="Bug general",
            descripcion="Detalle",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/feedback/admin/{reporte.id}/update/",
            {"estado": "resuelto", "respuesta_admin": "Corregido en release 1.2"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reporte.refresh_from_db()
        self.assertEqual(reporte.estado, "resuelto")
        self.assertEqual(reporte.respuesta_admin, "Corregido en release 1.2")
        self.assertEqual(reporte.respondido_por, self.admin)
        self.assertIsNotNone(reporte.resuelto_at)
