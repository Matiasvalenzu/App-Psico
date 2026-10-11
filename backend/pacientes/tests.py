from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import ConsentimientoInformado, Paciente
from .services import consentimiento_vigente

User = get_user_model()


class ConsentimientoPapelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="psi_cons", email="c@test.com", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(psicologo=self.user, nombre="Ana", apellido="Rojas")
        self.url = f"/api/pacientes/{self.paciente.id}/consentimiento/papel/"

    def test_vigente_con_firma_o_papel(self):
        self.assertFalse(consentimiento_vigente(self.paciente))
        ConsentimientoInformado.objects.create(
            paciente=self.paciente, psicologo=self.user, estado=ConsentimientoInformado.Estado.ENVIADO,
            token_hash="a",
        )
        self.assertFalse(consentimiento_vigente(self.paciente))
        ConsentimientoInformado.objects.create(
            paciente=self.paciente, psicologo=self.user, estado=ConsentimientoInformado.Estado.FIRMADO,
            token_hash="b",
        )
        self.assertTrue(consentimiento_vigente(self.paciente))

    def test_registrar_y_retirar_papel(self):
        response = self.client.post(self.url, {"fecha": "2026-01-15"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.data["consentimiento_vigente"])

        detalle = self.client.get(f"/api/pacientes/{self.paciente.id}/").data
        self.assertEqual(detalle["consentimiento_papel_fecha"], "2026-01-15")
        self.assertTrue(detalle["consentimiento_vigente"])

        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["consentimiento_vigente"])

    def test_fecha_por_defecto_hoy_y_validaciones(self):
        self.client.post(self.url, {}, format="json")
        self.paciente.refresh_from_db()
        self.assertEqual(self.paciente.consentimiento_papel_fecha, timezone.localdate())

        futura = (timezone.localdate() + timedelta(days=2)).isoformat()
        self.assertEqual(self.client.post(self.url, {"fecha": futura}, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, {"fecha": "ayer"}, format="json").status_code, 400)

    def test_no_se_edita_por_patch(self):
        self.client.patch(
            f"/api/pacientes/{self.paciente.id}/", {"consentimiento_papel_fecha": "2026-01-15"}, format="json"
        )
        self.paciente.refresh_from_db()
        self.assertIsNone(self.paciente.consentimiento_papel_fecha)

    def test_paciente_ajeno_404(self):
        otro = User.objects.create_user(username="otro_cons", email="o@test.com", password="x")
        self.client.force_authenticate(user=otro)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 404)
