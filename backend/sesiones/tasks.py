import logging

from celery import shared_task
from django.conf import settings

from sesiones.embeddings import generate_text_embedding
from voz.models import VoiceProfile
from voz.services import (
    average_embeddings,
    cosine_similarity,
    decode_audio_for_pyannote,
    extract_voice_embedding_from_path,
)

from .models import Sesion, TranscripcionSegmento

logger = logging.getLogger(__name__)


def _run_whisper(audio_path):
    from faster_whisper import WhisperModel

    model = WhisperModel(
        settings.WHISPER_MODEL,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )
    segments, _info = model.transcribe(
        audio_path,
        language="es",
        vad_filter=True,
        beam_size=5,
    )
    return [
        {
            "start": float(segment.start),
            "end": float(segment.end),
            "text": segment.text.strip(),
        }
        for segment in segments
        if segment.text and segment.text.strip()
    ]


def _run_diarization(audio_path):
    if not settings.PYANNOTE_AUTH_TOKEN:
        logger.info("PYANNOTE_AUTH_TOKEN no configurado; se omite diarización.")
        return []

    from pyannote.audio import Pipeline

    try:
        pipeline = Pipeline.from_pretrained(
            settings.PYANNOTE_PIPELINE_MODEL,
            token=settings.PYANNOTE_AUTH_TOKEN,
        )
    except TypeError:
        pipeline = Pipeline.from_pretrained(
            settings.PYANNOTE_PIPELINE_MODEL,
            use_auth_token=settings.PYANNOTE_AUTH_TOKEN,
        )

    diarization = pipeline(decode_audio_for_pyannote(audio_path))

    turns = []
    for turn, _track, speaker in diarization.itertracks(yield_label=True):
        turns.append(
            {
                "start": float(turn.start),
                "end": float(turn.end),
                "speaker": str(speaker),
            }
        )
    return turns


def _speaker_at_time(turns, second):
    for turn in turns:
        if turn["start"] <= second <= turn["end"]:
            return turn["speaker"]
    return None


def _build_speaker_map(audio_path, turns):
    labels = sorted({turn["speaker"] for turn in turns})
    if not labels:
        return {}

    default_map = {label: TranscripcionSegmento.Hablante.PACIENTE for label in labels}
    profile = VoiceProfile.objects.filter(activo=True).first()
    if not profile or not profile.embedding_vector:
        return default_map

    scored_labels = []
    for label in labels:
        label_embeddings = []
        label_turns = [turn for turn in turns if turn["speaker"] == label]
        for turn in label_turns[:5]:
            if turn["end"] - turn["start"] < 0.75:
                continue
            embedding = extract_voice_embedding_from_path(
                audio_path,
                start_second=turn["start"],
                end_second=turn["end"],
            )
            if embedding:
                label_embeddings.append(embedding)

        label_embedding = average_embeddings(label_embeddings)
        score = cosine_similarity(label_embedding, profile.embedding_vector)
        scored_labels.append((score, label))

    if not scored_labels:
        return default_map

    best_score, best_label = max(scored_labels, key=lambda item: item[0])
    if best_score >= settings.VOICE_MATCH_THRESHOLD:
        default_map[best_label] = TranscripcionSegmento.Hablante.PSICOLOGO
        logger.info("Speaker %s identificado como psicólogo (score %.3f)", best_label, best_score)
    else:
        logger.info("Ningún speaker superó umbral de voz (mejor %.3f)", best_score)

    return default_map


def _merge_transcription_segments(whisper_segments, turns, speaker_map):
    merged = []
    for segment in whisper_segments:
        midpoint = (segment["start"] + segment["end"]) / 2
        speaker_label = _speaker_at_time(turns, midpoint)
        hablante = speaker_map.get(speaker_label, TranscripcionSegmento.Hablante.PACIENTE)

        if (
            merged
            and merged[-1]["hablante"] == hablante
            and segment["start"] - merged[-1]["end"] <= 1.5
        ):
            merged[-1]["end"] = segment["end"]
            merged[-1]["text"] = f"{merged[-1]['text']} {segment['text']}".strip()
        else:
            merged.append(
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "hablante": hablante,
                    "text": segment["text"],
                }
            )

    return merged


@shared_task(bind=True, max_retries=1)
def procesar_audio_sesion(self, sesion_id):
    logger.info("Iniciando procesamiento de sesión %s", sesion_id)
    sesion = None

    try:
        sesion = Sesion.objects.get(id=sesion_id)
        sesion.estado = Sesion.Estado.PROCESANDO
        sesion.save(update_fields=["estado", "updated_at"])

        if not sesion.audio_path:
            raise ValueError("La sesión no tiene audio_path asociado.")

        whisper_segments = _run_whisper(sesion.audio_path)

        try:
            diarization_turns = _run_diarization(sesion.audio_path)
        except Exception as exc:
            diarization_turns = []
            logger.warning("Diarización omitida por error: %s", exc)

        speaker_map = _build_speaker_map(sesion.audio_path, diarization_turns)
        merged_segments = _merge_transcription_segments(
            whisper_segments,
            diarization_turns,
            speaker_map,
        )

        TranscripcionSegmento.objects.filter(sesion=sesion).delete()
        for index, segment in enumerate(merged_segments, start=1):
            TranscripcionSegmento.objects.create(
                sesion=sesion,
                orden=index,
                inicio_segundo=segment["start"],
                fin_segundo=segment["end"],
                hablante=segment["hablante"],
                texto=segment["text"],
                texto_original=segment["text"],
                embedding=generate_text_embedding(segment["text"]),
            )

        sesion.estado = Sesion.Estado.COMPLETADO
        sesion.save(update_fields=["estado", "updated_at"])
        logger.info("Sesión %s procesada exitosamente", sesion_id)
        return True

    except Sesion.DoesNotExist:
        logger.error("La sesión %s no existe.", sesion_id)
        return False
    except Exception as exc:
        logger.exception("Error procesando sesión %s", sesion_id)
        if sesion is not None:
            sesion.estado = Sesion.Estado.ERROR
            sesion.notas_sesion = (
                f"{sesion.notas_sesion}\n\nError automático de transcripción: {exc}"
            ).strip()
            sesion.save(update_fields=["estado", "notas_sesion", "updated_at"])
        raise self.retry(exc=exc, countdown=60)
