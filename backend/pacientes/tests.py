from datetime import timedelta
from types import SimpleNamespace

from cryptography.fernet import Fernet
from django.apps import apps as django_apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from config.fields import PREFIJO, _fernet, cifrar_existentes

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


class CifradoCamposTests(TestCase):
    def setUp(self):
        user = User.objects.create_user("cifra", password="x")
        self.paciente = Paciente.objects.create(
            psicologo=user, nombre="Ana", apellido="Rojas", notas_privadas="secreto clínico"
        )

    def _crudo(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT notas_privadas FROM pacientes_paciente WHERE id = %s", [self.paciente.id])
            return cursor.fetchone()[0]

    def _guardar_crudo(self, valor):
        with connection.cursor() as cursor:
            cursor.execute("UPDATE pacientes_paciente SET notas_privadas = %s WHERE id = %s", [valor, self.paciente.id])

    def test_se_guarda_cifrado_y_se_lee_en_claro(self):
        crudo = self._crudo()
        self.assertTrue(crudo.startswith(PREFIJO))
        self.assertNotIn("secreto", crudo)
        self.assertEqual(Paciente.objects.get(pk=self.paciente.pk).notas_privadas, "secreto clínico")
        self.assertEqual(
            Paciente.objects.values_list("notas_privadas", flat=True).get(pk=self.paciente.pk), "secreto clínico"
        )

    def test_tolera_texto_en_claro_y_migracion_reversible(self):
        self._guardar_crudo("en claro")
        self.assertEqual(Paciente.objects.get(pk=self.paciente.pk).notas_privadas, "en claro")

        operacion = cifrar_existentes("pacientes", "Paciente", ["notas_privadas"])
        editor = SimpleNamespace(connection=connection)
        operacion.code(django_apps, editor)
        self.assertTrue(self._crudo().startswith(PREFIJO))
        operacion.code(django_apps, editor)  # idempotente
        self.assertEqual(Paciente.objects.get(pk=self.paciente.pk).notas_privadas, "en claro")
        operacion.reverse_code(django_apps, editor)
        self.assertEqual(self._crudo(), "en claro")

    def test_rotacion_de_claves(self):
        nueva = Fernet.generate_key().decode()
        _fernet.cache_clear()
        try:
            with override_settings(FIELD_ENCRYPTION_KEYS=[nueva, *settings.FIELD_ENCRYPTION_KEYS]):
                self.assertEqual(Paciente.objects.get(pk=self.paciente.pk).notas_privadas, "secreto clínico")
        finally:
            _fernet.cache_clear()
