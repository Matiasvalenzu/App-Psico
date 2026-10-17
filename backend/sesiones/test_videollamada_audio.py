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
from sesiones.models import Sesion

User = get_user_model()


class VideollamadaAudioTests(TestCase):
    def setUp(self):
        self.audio_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.audio_root, ignore_errors=True)
        override = override_settings(AUDIO_STORAGE_PATH=self.audio_root)
        override.enable()
        self.addCleanup(override.disable)

        self.user = User.objects.create_user(username="psi_sala", email="sala@test.com", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(psicologo=self.user, nombre="Ana", apellido="Rojas")
        self.sesion = Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.user,
            origen=Sesion.Origen.VIRTUAL,
            plataforma_virtual=Sesion.Plataforma.PSICONEX,
            token_sala="sala-test",
            estado=Sesion.Estado.PENDIENTE,
            estado_videollamada=Sesion.EstadoVideollamada.EN_CURSO,
            duracion_segundos=0,
            videollamada_inicio=timezone.now() - timedelta(minutes=90),
        )

    def _audio(self, nombre="stereo.webm"):
        return SimpleUploadedFile(nombre, b"audio-videollamada", content_type="audio/webm")

    @patch("sesiones.tasks.procesar_audio_dual_track.delay")
    @patch("sesiones.videollamada.get_audio_duration_seconds", return_value=5400)
    def test_finalizar_marca_finalizada_y_calcula_duracion(self, _probe, _delay):
        response = self.client.post(
            f"/api/sesiones/{self.sesion.id}/finalizar_videollamada/",
            {"audio_stereo": self._audio()},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado_videollamada, Sesion.EstadoVideollamada.FINALIZADA)
        self.assertEqual(self.sesion.estado, Sesion.Estado.PROCESANDO)
        self.assertEqual(self.sesion.duracion_segundos, 5400)
        self.assertTrue(os.path.exists(self.sesion.audio_path))

    @patch("sesiones.tasks.procesar_audio_dual_track.delay")
    @patch("sesiones.videollamada.get_audio_duration_seconds", return_value=0)
    def test_duracion_usa_inicio_real_si_ffprobe_no_informa(self, _probe, _delay):
        response = self.client.post(
            f"/api/sesiones/{self.sesion.id}/finalizar_videollamada/",
            {"audio_stereo": self._audio(), "duracion_segundos": "0"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.sesion.refresh_from_db()
        self.assertGreaterEqual(self.sesion.duracion_segundos, 90 * 60 - 5)
        self.assertLessEqual(self.sesion.duracion_segundos, 90 * 60 + 5)

    @patch("sesiones.tasks.procesar_audio_sesion.delay")
    @patch("sesiones.videollamada.get_audio_duration_seconds", return_value=0)
    def test_upload_audio_finaliza_videollamada_no_cerrada(self, _probe, _delay):
        self.sesion.videollamada_inicio = None
        self.sesion.duracion_segundos = None
        self.sesion.save(update_fields=["videollamada_inicio", "duracion_segundos"])

        response = self.client.post(
            f"/api/sesiones/{self.sesion.id}/upload_audio/",
            {"audio": self._audio("grabacion.webm"), "duracion_segundos": 3720},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado_videollamada, Sesion.EstadoVideollamada.FINALIZADA)
        self.assertEqual(self.sesion.duracion_segundos, 3720)

    def test_upload_audio_sigue_exigiendo_jwt(self):
        anon = APIClient()
        response = anon.post(
            f"/api/sesiones/{self.sesion.id}/upload_audio/",
            {"audio": self._audio("grabacion.webm")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 401)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.estado_videollamada, Sesion.EstadoVideollamada.EN_CURSO)
        self.assertEqual(self.sesion.duracion_segundos, 0)
