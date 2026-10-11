"""Tests del ciclo de vida efímero del audio (sin modelos ni APIs reales)."""
import os
import shutil
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from pacientes.models import Paciente
from sesiones import tasks
from sesiones.audio import carpeta_audio_paciente, purgar_audios
from sesiones.models import Sesion

User = get_user_model()


class AudioEfimeroTests(TestCase):
    def setUp(self):
        self.audio_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.audio_root, ignore_errors=True)
        override = override_settings(AUDIO_STORAGE_PATH=self.audio_root, AUDIO_RETENCION_ERROR_DIAS=7)
        override.enable()
        self.addCleanup(override.disable)

        self.user = User.objects.create_user(username="psi_audio", email="a@test.com", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(psicologo=self.user, nombre="Ana", apellido="Rojas")
        self.sesion = Sesion.objects.create(paciente=self.paciente, psicologo=self.user)
        self.carpeta = carpeta_audio_paciente(self.paciente.id)
        os.makedirs(self.carpeta, exist_ok=True)

    def _escribir(self, nombre):
        ruta = os.path.join(self.carpeta, nombre)
        with open(ruta, "wb") as f:
            f.write(b"audio")
        return ruta

    @patch.object(tasks, "_notify_session_ready")
    @patch.object(tasks, "generate_text_embedding", return_value=None)
    @patch.object(tasks, "_build_speaker_map", return_value=({}, {}))
    @patch.object(tasks, "_run_diarization", return_value=[])
    @patch.object(tasks, "_run_whisper", return_value=[{"start": 0.0, "end": 1.0, "text": "hola"}])
    def test_audio_se_borra_tras_transcribir(self, *_mocks):
        ruta = self._escribir(f"{self.sesion.id}.webm")
        self.sesion.audio_path = ruta
        self.sesion.save()

        self.assertTrue(tasks.procesar_audio_sesion(self.sesion.id))

        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado, Sesion.Estado.COMPLETADO)
        self.assertFalse(os.path.exists(ruta))
        self.assertIsNotNone(self.sesion.audio_eliminado_en)
        self.assertEqual(self.sesion.audio_path, ruta)

    @patch("sesiones.tasks.procesar_audio_sesion.delay")
    def test_reupload_con_otra_extension_no_deja_huerfanos(self, _delay):
        viejo = self._escribir(f"{self.sesion.id}.wav")
        self.sesion.audio_path = viejo
        self.sesion.audio_eliminado_en = timezone.now()
        self.sesion.save()

        archivo = SimpleUploadedFile("nuevo.webm", b"nuevo", content_type="audio/webm")
        response = self.client.post(
            f"/api/sesiones/{self.sesion.id}/upload_audio/", {"audio": archivo}, format="multipart"
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(os.path.exists(viejo))
        self.assertEqual(os.listdir(self.carpeta), [f"{self.sesion.id}.webm"])
        self.sesion.refresh_from_db()
        self.assertIsNone(self.sesion.audio_eliminado_en)

    def test_borrar_sesion_borra_todos_sus_audios(self):
        rutas = [self._escribir(f"{self.sesion.id}{s}") for s in (".webm", "_psicologo.webm", "_paciente.webm", "_split_paciente.wav")]
        otra = self._escribir("999999.webm")

        response = self.client.delete(f"/api/sesiones/{self.sesion.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(any(os.path.exists(r) for r in rutas))
        self.assertTrue(os.path.exists(otra))

    def test_borrar_paciente_borra_su_carpeta(self):
        self._escribir(f"{self.sesion.id}.webm")

        response = self.client.delete(f"/api/pacientes/{self.paciente.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(os.path.exists(self.carpeta))

    def test_purga_conserva_solo_audio_reciente_pendiente(self):
        completada = Sesion.objects.create(paciente=self.paciente, psicologo=self.user, estado=Sesion.Estado.COMPLETADO)
        fallida_vieja = Sesion.objects.create(paciente=self.paciente, psicologo=self.user, estado=Sesion.Estado.ERROR)
        fallida_reciente = Sesion.objects.create(paciente=self.paciente, psicologo=self.user, estado=Sesion.Estado.ERROR)
        hace_10_dias = timezone.now() - timedelta(days=10)
        Sesion.objects.filter(pk=fallida_vieja.pk).update(updated_at=hace_10_dias)

        r_completada = self._escribir(f"{completada.id}.webm")
        r_vieja = self._escribir(f"{fallida_vieja.id}_split_paciente.wav")
        os.utime(r_vieja, (hace_10_dias.timestamp(),) * 2)
        r_reciente = self._escribir(f"{fallida_reciente.id}.webm")
        r_inexistente = self._escribir("987654.webm")
        Sesion.objects.filter(pk=completada.pk).update(audio_path=r_completada)

        self.assertEqual(purgar_audios(dry_run=True)[0], 3)
        self.assertTrue(os.path.exists(r_completada))

        archivos, total_bytes = purgar_audios()

        self.assertEqual((archivos, total_bytes), (3, 15))
        self.assertTrue(os.path.exists(r_reciente))
        for ruta in (r_completada, r_vieja, r_inexistente):
            self.assertFalse(os.path.exists(ruta))
        completada.refresh_from_db()
        self.assertIsNotNone(completada.audio_eliminado_en)
