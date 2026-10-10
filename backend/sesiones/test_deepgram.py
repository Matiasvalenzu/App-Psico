"""Tests de diarización con Deepgram (respuestas simuladas, sin llamadas reales)."""
import tempfile
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from sesiones import tasks


def _response(status=200, payload=None):
    response = MagicMock()
    response.status_code = status
    response.json.return_value = payload or {}
    return response


DEEPGRAM_PAYLOAD = {
    "results": {
        "utterances": [
            {"start": 0.0, "end": 2.5, "speaker": 0, "transcript": "hola"},
            {"start": 2.5, "end": 5.0, "speaker": 1, "transcript": "buenas"},
            {"start": 5.0, "end": None, "speaker": 0},
            {"start": 6.0, "end": 7.0},
        ]
    }
}


@override_settings(
    DEEPGRAM_API_KEY="test-key",
    DEEPGRAM_API_URL="https://api.deepgram.com/v1/listen",
    DEEPGRAM_MODEL="nova-3",
    DEEPGRAM_LANGUAGE="es",
    DEEPGRAM_REQUEST_TIMEOUT_SECONDS=5,
)
class DeepgramDiarizationTests(SimpleTestCase):
    def setUp(self):
        self.audio = tempfile.NamedTemporaryFile(suffix=".wav")
        self.audio.write(b"RIFFfake")
        self.audio.flush()
        self.addCleanup(self.audio.close)

    def test_extract_turns_uses_pyannote_speaker_format(self):
        turns = tasks._extract_deepgram_turns(DEEPGRAM_PAYLOAD)
        self.assertEqual(
            turns,
            [
                {"start": 0.0, "end": 2.5, "speaker": "SPEAKER_00"},
                {"start": 2.5, "end": 5.0, "speaker": "SPEAKER_01"},
            ],
        )

    def test_extract_turns_empty_response(self):
        self.assertEqual(tasks._extract_deepgram_turns({}), [])

    @patch("sesiones.tasks.requests.post")
    def test_request_params_and_headers(self, post):
        post.return_value = _response(200, DEEPGRAM_PAYLOAD)
        turns = tasks._run_deepgram_diarization(self.audio.name)
        self.assertEqual(len(turns), 2)
        _, kwargs = post.call_args
        self.assertEqual(post.call_args[0][0], "https://api.deepgram.com/v1/listen")
        self.assertEqual(kwargs["headers"]["Authorization"], "Token test-key")
        self.assertIn("audio", kwargs["headers"]["Content-Type"])
        self.assertEqual(
            kwargs["params"],
            {
                "model": "nova-3",
                "language": "es",
                "diarize": "true",
                "utterances": "true",
                "punctuate": "true",
            },
        )
        self.assertEqual(kwargs["timeout"], 5)

    @patch("sesiones.tasks.requests.post")
    def test_retries_once_on_5xx(self, post):
        post.side_effect = [_response(503), _response(200, DEEPGRAM_PAYLOAD)]
        turns = tasks._run_deepgram_diarization(self.audio.name)
        self.assertEqual(post.call_count, 2)
        self.assertEqual(len(turns), 2)

    @patch("sesiones.tasks.requests.post")
    def test_persistent_5xx_raises_after_one_retry(self, post):
        post.return_value = _response(500)
        with self.assertRaises(RuntimeError):
            tasks._run_deepgram_diarization(self.audio.name)
        self.assertEqual(post.call_count, 2)

    @patch("sesiones.tasks.requests.post")
    def test_4xx_does_not_retry(self, post):
        post.return_value = _response(401)
        with self.assertRaises(RuntimeError):
            tasks._run_deepgram_diarization(self.audio.name)
        self.assertEqual(post.call_count, 1)

    @override_settings(DEEPGRAM_API_KEY="")
    @patch("sesiones.tasks.requests.post")
    def test_without_api_key_skips(self, post):
        self.assertEqual(tasks._run_deepgram_diarization(self.audio.name), [])
        post.assert_not_called()

    @override_settings(DIARIZATION_BACKEND="deepgram")
    @patch("sesiones.tasks._run_pyannote_diarization")
    @patch("sesiones.tasks._run_deepgram_diarization", return_value=[{"start": 0, "end": 1, "speaker": "SPEAKER_00"}])
    def test_selector_deepgram(self, deepgram, pyannote):
        self.assertEqual(len(tasks._run_diarization("a.wav")), 1)
        deepgram.assert_called_once_with("a.wav")
        pyannote.assert_not_called()

    @override_settings(DIARIZATION_BACKEND="pyannote")
    @patch("sesiones.tasks._run_pyannote_diarization", return_value=[])
    @patch("sesiones.tasks._run_deepgram_diarization")
    def test_selector_pyannote(self, deepgram, pyannote):
        tasks._run_diarization("a.wav")
        pyannote.assert_called_once_with("a.wav")
        deepgram.assert_not_called()

    @patch("sesiones.tasks.requests.post", side_effect=ConnectionError("boom"))
    def test_failure_is_a_warning_and_session_stays_without_speakers(self, post):
        """procesar_audio_sesion captura el error de diarización y sigue sin hablantes."""
        sesion = MagicMock(audio_path=self.audio.name, psicologo=MagicMock())
        qs = MagicMock()
        qs.get.return_value = sesion
        with patch.object(tasks.Sesion.objects, "select_related", return_value=qs), \
                patch.object(tasks, "_run_whisper", return_value=[]), \
                patch.object(tasks, "_build_speaker_map", return_value=({}, [])) as build, \
                patch.object(tasks, "_merge_transcription_segments", return_value=[]), \
                patch.object(tasks.TranscripcionSegmento, "objects"), \
                self.assertLogs(tasks.logger, level="WARNING") as logs:
            result = tasks.procesar_audio_sesion.run(1)
        self.assertTrue(result)
        self.assertEqual(build.call_args[0][2], [])  # sin turnos de diarización
        self.assertTrue(any("Diarización omitida" in line for line in logs.output))
