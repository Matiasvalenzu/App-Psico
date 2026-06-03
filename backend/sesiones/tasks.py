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
    get_audio_duration_seconds,
)

from .models import Sesion, SpeakerIdentificationResult, TranscripcionSegmento

logger = logging.getLogger(__name__)

FULL_AUDIO_LABEL = "AUDIO_COMPLETO"

# Cached models — loaded once per worker process, reused across tasks.
_whisper_model = None
_pyannote_pipeline = None


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


def _get_pyannote_pipeline():
    global _pyannote_pipeline
    if _pyannote_pipeline is None:
        from pyannote.audio import Pipeline
        logger.info("Cargando pipeline Pyannote '%s'…", settings.PYANNOTE_PIPELINE_MODEL)
        try:
            _pyannote_pipeline = Pipeline.from_pretrained(
                settings.PYANNOTE_PIPELINE_MODEL,
                token=settings.PYANNOTE_AUTH_TOKEN,
            )
        except TypeError:
            _pyannote_pipeline = Pipeline.from_pretrained(
                settings.PYANNOTE_PIPELINE_MODEL,
                use_auth_token=settings.PYANNOTE_AUTH_TOKEN,
            )
        logger.info("Pipeline Pyannote cargado.")
    return _pyannote_pipeline


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


def _run_diarization(audio_path):
    if not settings.PYANNOTE_AUTH_TOKEN:
        logger.info("PYANNOTE_AUTH_TOKEN no configurado; se omite diarización.")
        return []

    pipeline = _get_pyannote_pipeline()

    # Acotar a max 2 speakers (psicólogo + paciente) acelera el clustering;
    # min=1 permite que grabaciones de un solo hablante no se dividan artificialmente.
    diarization_output = pipeline(decode_audio_for_pyannote(audio_path), min_speakers=1, max_speakers=2)
    diarization = getattr(
        diarization_output,
        "exclusive_speaker_diarization",
        diarization_output,
    )

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
