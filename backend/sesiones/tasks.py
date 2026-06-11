import logging
import mimetypes
import time
import uuid
from pathlib import Path

import requests
from celery import shared_task
from django.conf import settings

from sesiones.embeddings import generate_text_embedding
from voz.models import VoiceProfile
from voz.services import (
    average_embeddings,
    cosine_similarity,
    extract_voice_embedding_from_path,
    get_audio_duration_seconds,
)

from .models import Sesion, SpeakerIdentificationResult, TranscripcionSegmento

logger = logging.getLogger(__name__)

FULL_AUDIO_LABEL = "AUDIO_COMPLETO"
PYANNOTE_TERMINAL_STATUSES = {"succeeded", "failed", "canceled"}

# Cached models — loaded once per worker process, reused across tasks.
_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        logger.info("Cargando modelo Whisper '%s'…", settings.WHISPER_MODEL)
        _whisper_model = WhisperModel(
            settings.WHISPER_MODEL,
            device=settings.WHISPER_DEVICE,
            compute_type=settings.WHISPER_COMPUTE_TYPE,
        )
        logger.info("Modelo Whisper cargado.")
    return _whisper_model


def _run_whisper(audio_path):
    model = _get_whisper_model()
    segments, _info = model.transcribe(
        audio_path,
        language="es",
        vad_filter=True,
        beam_size=1,
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


def _pyannote_api_url(path):
    return f"{settings.PYANNOTE_API_BASE_URL.rstrip('/')}{path}"


def _pyannote_headers():
    return {"Authorization": f"Bearer {settings.PYANNOTE_AUTH_TOKEN}"}


def _raise_for_pyannote_response(response, action):
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        detail = response.text[:500]
        raise RuntimeError(
            f"PyannoteAI {action} falló ({response.status_code}): {detail}"
        ) from exc


def _upload_audio_to_pyannote(audio_path):
    suffix = Path(audio_path).suffix or ".audio"
    media_url = f"media://sesiones/{uuid.uuid4().hex}{suffix}"

    response = requests.post(
        _pyannote_api_url("/v1/media/input"),
        json={"url": media_url},
        headers={**_pyannote_headers(), "Content-Type": "application/json"},
        timeout=settings.PYANNOTE_API_REQUEST_TIMEOUT_SECONDS,
    )
    _raise_for_pyannote_response(response, "no pudo crear URL de subida")
    upload_url = response.json().get("url")
    if not upload_url:
        raise RuntimeError("PyannoteAI no devolvió URL de subida.")

    content_type = mimetypes.guess_type(audio_path)[0] or "application/octet-stream"
    with open(audio_path, "rb") as audio_file:
        upload_response = requests.put(
            upload_url,
            data=audio_file,
            headers={"Content-Type": content_type},
            timeout=settings.PYANNOTE_API_UPLOAD_TIMEOUT_SECONDS,
        )
    _raise_for_pyannote_response(upload_response, "no pudo subir audio")
    return media_url


def _create_pyannote_diarization_job(media_url):
    payload = {
        "url": media_url,
        "minSpeakers": 1,
        "maxSpeakers": 2,
        "exclusive": True,
    }
    if settings.PYANNOTE_API_MODEL:
        payload["model"] = settings.PYANNOTE_API_MODEL

    response = requests.post(
        _pyannote_api_url("/v1/diarize"),
        json=payload,
        headers={**_pyannote_headers(), "Content-Type": "application/json"},
        timeout=settings.PYANNOTE_API_REQUEST_TIMEOUT_SECONDS,
    )
    _raise_for_pyannote_response(response, "no pudo crear job de diarización")
    job_id = response.json().get("jobId")
    if not job_id:
        raise RuntimeError("PyannoteAI no devolvió jobId.")
    return job_id


def _wait_for_pyannote_job(job_id):
    deadline = time.monotonic() + settings.PYANNOTE_API_TIMEOUT_SECONDS

    while True:
        response = requests.get(
            _pyannote_api_url(f"/v1/jobs/{job_id}"),
            headers=_pyannote_headers(),
            timeout=settings.PYANNOTE_API_REQUEST_TIMEOUT_SECONDS,
        )
        _raise_for_pyannote_response(response, "no pudo consultar job")
        data = response.json()
        status = data.get("status")

        if status == "succeeded":
            return data
        if status in PYANNOTE_TERMINAL_STATUSES:
            output = data.get("output") or {}
            detail = output.get("error") or output.get("warning") or status
            raise RuntimeError(
                f"PyannoteAI job {job_id} terminó en estado {status}: {detail}"
            )
        if time.monotonic() >= deadline:
            raise TimeoutError(
                f"PyannoteAI job {job_id} excedió timeout de "
                f"{settings.PYANNOTE_API_TIMEOUT_SECONDS}s."
            )

        time.sleep(settings.PYANNOTE_API_POLL_INTERVAL_SECONDS)


def _extract_pyannote_turns(job_data):
    output = job_data.get("output") or {}
    if output.get("warning"):
        logger.warning("PyannoteAI warning: %s", output["warning"])

    segments = output.get("exclusiveDiarization") or output.get("diarization") or []
    turns = []
    for segment in segments:
        start = segment.get("start")
        end = segment.get("end")
        speaker = segment.get("speaker")
        if start is None or end is None or speaker is None:
            continue
        turns.append(
            {
                "start": float(start),
                "end": float(end),
                "speaker": str(speaker),
            }
        )
    return turns


def _run_diarization(audio_path):
    if not settings.PYANNOTE_AUTH_TOKEN:
        logger.info("PYANNOTE_AUTH_TOKEN no configurado; se omite diarización.")
        return []

    logger.info("Subiendo audio a PyannoteAI para diarización.")
    media_url = _upload_audio_to_pyannote(audio_path)
    job_id = _create_pyannote_diarization_job(media_url)
    logger.info("PyannoteAI job %s creado; esperando resultado.", job_id)
    job_data = _wait_for_pyannote_job(job_id)
    turns = _extract_pyannote_turns(job_data)
    logger.info("PyannoteAI job %s completado con %s turnos.", job_id, len(turns))
    return turns


def _speaker_at_time(turns, second):
    for turn in turns:
        if turn["start"] <= second <= turn["end"]:
            return turn["speaker"]
    return None


def _get_session_voice_profile(sesion):
    if not sesion.psicologo_id:
        return None, "sin_psicologo_asociado"

    try:
        profile = sesion.psicologo.voice_profile
    except VoiceProfile.DoesNotExist:
        return None, "sin_perfil_ecapa"

    if not profile.is_compatible:
        return profile, "perfil_legacy_requiere_regrabacion"

    return profile, ""


def _extract_label_embedding(audio_path, label_turns):
    embeddings = []
    total_duration = 0.0
    used_turns = 0

    for turn in label_turns:
        duration = max(turn["end"] - turn["start"], 0.0)
        if duration < settings.SPEAKER_MIN_TURN_SECONDS:
            continue

        remaining = settings.SPEAKER_MAX_SECONDS_PER_LABEL - total_duration
        if remaining <= 0:
            break

        start = turn["start"]
        end = min(turn["end"], start + remaining)
        embedding = extract_voice_embedding_from_path(
            audio_path,
            start_second=start,
            end_second=end,
        )
        if embedding:
            embeddings.append(embedding)
            total_duration += end - start
            used_turns += 1

    if total_duration < settings.SPEAKER_MIN_TOTAL_SECONDS:
        return [], total_duration, used_turns

    return average_embeddings(embeddings), total_duration, used_turns


def _create_result(
    sesion,
    label,
    profile,
    score,
    total_duration,
    turn_count,
    assigned_hablante,
    reason,
):
    return SpeakerIdentificationResult.objects.create(
        sesion=sesion,
        pyannote_label=label,
        matched_profile=profile if profile and profile.is_compatible else None,
        score=score,
        threshold=settings.SPEAKER_MATCH_THRESHOLD,
        assigned_hablante=assigned_hablante,
        total_duration_seconds=total_duration,
        turn_count=turn_count,
        model_name=settings.SPEAKER_EMBEDDING_MODEL,
        reason=reason,
    )


def _build_speaker_map(sesion, audio_path, turns):
    SpeakerIdentificationResult.objects.filter(sesion=sesion).delete()

    labels = sorted({turn["speaker"] for turn in turns})
    if not labels:
        profile, profile_error = _get_session_voice_profile(sesion)
        total_duration = min(
            float(sesion.duracion_segundos or 0) or get_audio_duration_seconds(audio_path),
            settings.SPEAKER_MAX_SECONDS_PER_LABEL,
        )

        if profile_error:
            result = _create_result(
                sesion=sesion,
                label=FULL_AUDIO_LABEL,
                profile=profile,
                score=None,
                total_duration=total_duration,
                turn_count=0,
                assigned_hablante=TranscripcionSegmento.Hablante.PACIENTE,
                reason=f"sin_diarizacion_{profile_error}",
            )
            return {FULL_AUDIO_LABEL: TranscripcionSegmento.Hablante.PACIENTE}, {
                FULL_AUDIO_LABEL: result,
            }

        full_audio_embedding = extract_voice_embedding_from_path(
            audio_path,
            start_second=0,
            end_second=total_duration or None,
        )

        score = None
        assigned_hablante = TranscripcionSegmento.Hablante.PACIENTE
        reason = "sin_diarizacion_voz_insuficiente_para_embedding"

        if full_audio_embedding:
            score = cosine_similarity(full_audio_embedding, profile.embedding_vector)
            if score >= settings.SPEAKER_MATCH_THRESHOLD:
                assigned_hablante = TranscripcionSegmento.Hablante.PSICOLOGO
                reason = "sin_diarizacion_audio_completo_sobre_umbral"
            else:
                reason = "sin_diarizacion_score_bajo"

        result = _create_result(
            sesion=sesion,
            label=FULL_AUDIO_LABEL,
            profile=profile,
            score=score,
            total_duration=total_duration,
            turn_count=1 if full_audio_embedding else 0,
            assigned_hablante=assigned_hablante,
            reason=reason,
        )
        return {FULL_AUDIO_LABEL: assigned_hablante}, {FULL_AUDIO_LABEL: result}

    default_map = {label: TranscripcionSegmento.Hablante.PACIENTE for label in labels}
    profile, profile_error = _get_session_voice_profile(sesion)
    if profile_error:
        results = {}
        for label in labels:
            label_turns = [turn for turn in turns if turn["speaker"] == label]
            total_duration = sum(max(turn["end"] - turn["start"], 0.0) for turn in label_turns)
            results[label] = _create_result(
                sesion=sesion,
                label=label,
                profile=profile,
                score=None,
                total_duration=total_duration,
                turn_count=len(label_turns),
                assigned_hablante=TranscripcionSegmento.Hablante.PACIENTE,
                reason=profile_error,
            )
        return default_map, results

    scored_labels = []
    label_records = {}
    for label in labels:
        label_turns = [turn for turn in turns if turn["speaker"] == label]
        label_embedding, total_duration, used_turns = _extract_label_embedding(
            audio_path,
            label_turns,
        )
        label_records[label] = {
            "score": None,
            "total_duration": total_duration,
            "turn_count": used_turns,
            "reason": "voz_insuficiente_para_embedding",
        }
        if not label_embedding:
            continue

        score = cosine_similarity(label_embedding, profile.embedding_vector)
        label_records[label].update(
            {
                "score": score,
                "reason": "score_comparado",
            }
        )
        scored_labels.append((score, label))

    if not scored_labels:
        results = {}
        for label, record in label_records.items():
            results[label] = _create_result(
                sesion=sesion,
                label=label,
                profile=profile,
                score=record["score"],
                total_duration=record["total_duration"],
                turn_count=record["turn_count"],
                assigned_hablante=TranscripcionSegmento.Hablante.PACIENTE,
                reason=record["reason"],
            )
        return default_map, results

    scored_labels.sort(reverse=True)
    best_score, best_label = scored_labels[0]
    second_score = scored_labels[1][0] if len(scored_labels) > 1 else None
    matched_label = None
    best_reason = "score_bajo"

    if best_score >= settings.SPEAKER_MATCH_THRESHOLD:
        if second_score is None or best_score - second_score >= settings.SPEAKER_MATCH_MARGIN:
            matched_label = best_label
            best_reason = "score_sobre_umbral"
        else:
            best_reason = "margen_insuficiente"

    if matched_label:
        default_map[matched_label] = TranscripcionSegmento.Hablante.PSICOLOGO
        logger.info(
            "Speaker %s identificado como psicólogo (score %.3f)",
            matched_label,
            best_score,
        )
    else:
        logger.info("Ningún speaker superó reglas ECAPA (mejor %.3f)", best_score)

    results = {}
    for label, record in label_records.items():
        assigned = default_map[label]
        reason = record["reason"]
        if label == best_label:
            reason = best_reason
        elif record["score"] is not None and matched_label:
            reason = "otro_hablante"

        results[label] = _create_result(
            sesion=sesion,
            label=label,
            profile=profile,
            score=record["score"],
            total_duration=record["total_duration"],
            turn_count=record["turn_count"],
            assigned_hablante=assigned,
            reason=reason,
        )

    return default_map, results


def _merge_transcription_segments(whisper_segments, turns, speaker_map, speaker_results):
    merged = []
    for segment in whisper_segments:
        midpoint = (segment["start"] + segment["end"]) / 2
        speaker_label = _speaker_at_time(turns, midpoint)
        if speaker_label is None and FULL_AUDIO_LABEL in speaker_map:
            speaker_label = FULL_AUDIO_LABEL
        hablante = speaker_map.get(speaker_label, TranscripcionSegmento.Hablante.PACIENTE)
        speaker_result = speaker_results.get(speaker_label) if speaker_label else None

        if (
            merged
            and merged[-1]["hablante"] == hablante
            and merged[-1]["speaker_label"] == (speaker_label or "")
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
                    "speaker_label": speaker_label or "",
                    "speaker_match_score": speaker_result.score if speaker_result else None,
                    "speaker_match_threshold": (
                        speaker_result.threshold if speaker_result else None
                    ),
                    "speaker_match_model": (
                        speaker_result.model_name if speaker_result else ""
                    ),
                    "text": segment["text"],
                }
            )

    return merged


@shared_task(bind=True, max_retries=1)
def procesar_audio_sesion(self, sesion_id):
    logger.info("Iniciando procesamiento de sesión %s", sesion_id)
    sesion = None

    try:
        sesion = Sesion.objects.select_related("psicologo", "psicologo__voice_profile").get(id=sesion_id)
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

        speaker_map, speaker_results = _build_speaker_map(
            sesion,
            sesion.audio_path,
            diarization_turns,
        )
        merged_segments = _merge_transcription_segments(
            whisper_segments,
            diarization_turns,
            speaker_map,
            speaker_results,
        )

        TranscripcionSegmento.objects.filter(sesion=sesion).delete()
        for index, segment in enumerate(merged_segments, start=1):
            TranscripcionSegmento.objects.create(
                sesion=sesion,
                orden=index,
                inicio_segundo=segment["start"],
                fin_segundo=segment["end"],
                hablante=segment["hablante"],
                speaker_label=segment["speaker_label"],
                speaker_match_score=segment["speaker_match_score"],
                speaker_match_threshold=segment["speaker_match_threshold"],
                speaker_match_model=segment["speaker_match_model"],
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
