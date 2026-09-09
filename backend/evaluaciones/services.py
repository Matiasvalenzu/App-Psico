import hashlib
import os
import re
import secrets
from functools import lru_cache

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from cuentas.services import get_notification_email
from notificaciones.services import send_branded_email
from sesiones.documentos import split_text_into_segments
from sesiones.embeddings import generate_text_embedding
from sesiones.models import Sesion, TranscripcionSegmento

from .catalog import (
    DE_ACUERDO,
    ELLIS_SLUG,
    NO_DE_ACUERDO,
    RUEDA_CREENCIAS_SLUG,
    RUEDA_VIDA_SLUG,
    evaluate_ellis,
    evaluate_rueda_creencias,
    evaluate_rueda_vida,
    get_test,
)
from .models import EvaluacionAsignada, ResultadoEvaluacion


TOKEN_RE = re.compile(r"[\wáéíóúñü]+", re.IGNORECASE)


def sanitize_markdown_emphasis(text):
    text = text or ""

    def uppercase_match(match):
        return match.group(1).strip().upper()

    text = re.sub(r"\*\*([^*]+)\*\*", uppercase_match, text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    return text.replace("**", "").strip()


def generate_token():
    return secrets.token_urlsafe(32)


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_public_test_url(token):
    base_url = getattr(settings, "PUBLIC_APP_URL", "http://localhost:3000").strip()
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return f"{base_url.rstrip('/')}/tests/{token}"


def fixed_email_message(psicologo, paciente, public_url, test_slug=None):
    psicologo_nombre = (
        psicologo.get_full_name() or psicologo.username or "tu psicólogo/a"
    )
    test = get_test(test_slug) if test_slug else None
    test_name = test["name"] if test else "Test Psicológico"
    return (
        f"Hola {paciente.nombre},\n\n"
        f"{psicologo_nombre} te solicita completar el {test_name} "
        "como parte de tu proceso de atención psicológica.\n\n"
        "Puedes responderlo en el siguiente enlace:\n"
        f"{public_url}\n\n"
        f"El enlace es personal, vence en {settings.TEST_LINK_EXPIRATION_DAYS} días "
        "y solo puede utilizarse una vez. "
        "No necesitas iniciar sesión ni ingresar datos adicionales.\n\n"
        "Este instrumento no reemplaza la evaluación profesional; sus resultados "
        "serán revisados por tu psicólogo/a.\n\n"
        "Saludos,\n"
        "Equipo Psiconex"
    )


def send_assignment_email(asignacion):
    if not getattr(settings, "EMAIL_HOST", "") or not getattr(settings, "DEFAULT_FROM_EMAIL", ""):
        return False, "SMTP no configurado; se generó el enlace para envío manual."

    test = get_test(asignacion.test_slug)
    test_name = test["name"] if test else "Test Psicológico"
    subject = f"Solicitud para completar {test_name}"
    psychologist_name = (
        asignacion.psicologo.get_full_name()
        or asignacion.psicologo.username
        or "tu psicólogo/a"
    )
    try:
        send_branded_email(
            subject=subject,
            recipient=asignacion.email_destino,
            template_name="evaluacion",
            context={
                "patient_name": asignacion.paciente.nombre,
                "psychologist_name": psychologist_name,
                "public_url": asignacion.enlace_generado,
                "expiration_days": settings.TEST_LINK_EXPIRATION_DAYS,
            },
            reply_to=get_notification_email(asignacion.psicologo)
            or settings.EMAIL_SUPPORT_ADDRESS,
        )
        return True, ""
    except Exception:
        return False, "No fue posible entregar el correo. Se reintentará cuando vuelvas a enviarlo."


def find_assignment_by_token(token):
    token_digest = hash_token(token)
    return (
        EvaluacionAsignada.objects.select_related("paciente", "psicologo", "sesion")
        .filter(token_hash=token_digest)
        .first()
    )


def validate_public_assignment(asignacion):
    if asignacion.estado == EvaluacionAsignada.Estado.COMPLETADO:
        return "COMPLETADO", "Este test ya fue completado."
    if asignacion.esta_expirada:
        if asignacion.estado != EvaluacionAsignada.Estado.EXPIRADO:
            asignacion.estado = EvaluacionAsignada.Estado.EXPIRADO
            asignacion.save(update_fields=["estado", "updated_at"])
        return "EXPIRADO", "El enlace expiró. Solicita uno nuevo a tu psicólogo/a."
    return "DISPONIBLE", ""


def normalize_responses(raw_responses):
    if not isinstance(raw_responses, dict):
        raise ValueError("Las respuestas deben enviarse como objeto.")

    test = get_test(ELLIS_SLUG)
    question_ids = {question["id"] for question in test["questions"]}
    normalized = {}
    for question_id in question_ids:
        key = str(question_id)
        value = raw_responses.get(key, raw_responses.get(question_id))
        if value not in {DE_ACUERDO, NO_DE_ACUERDO}:
            raise ValueError(f"Falta responder la pregunta {question_id}.")
        normalized[key] = value
    return normalized


def normalize_rueda_responses(raw_responses):
    if not isinstance(raw_responses, dict):
        raise ValueError("Las respuestas deben enviarse como objeto.")

    test = get_test(RUEDA_VIDA_SLUG) or get_test(RUEDA_CREENCIAS_SLUG)
    question_ids = {question["id"] for question in test["questions"]}
    normalized = {}

    for q_id in question_ids:
        key = str(q_id)
        raw = raw_responses.get(key, raw_responses.get(q_id))
        if isinstance(raw, dict):
            val = raw.get("score", raw.get("actual", raw.get("now", raw.get("value"))))
        else:
            val = raw

        if val is None:
            val = raw_responses.get(f"{key}_actual", raw_responses.get(f"{key}_score"))

        if val is None:
            raise ValueError(f"Falta responder el área {q_id}.")

        try:
            val_int = int(val)
        except (ValueError, TypeError):
            raise ValueError(f"El valor para el área {q_id} debe ser un número del 1 al 10.")

        if not (1 <= val_int <= 10):
            raise ValueError(f"El puntaje del área {q_id} debe estar entre 1 y 10.")

        normalized[key] = val_int

    return normalized


def complete_assignment(asignacion, raw_responses):
    test_slug = asignacion.test_slug
    test = get_test(test_slug) or get_test(ELLIS_SLUG)

    if test_slug in (RUEDA_VIDA_SLUG, RUEDA_CREENCIAS_SLUG):
        responses = normalize_rueda_responses(raw_responses)
        scores = evaluate_rueda_vida(responses)
        interpretation = {
            "criterio": (
                "Puntajes de 8 a 10 señalan áreas de alta satisfacción y fortaleza vital. "
                "Puntajes de 5 a 7 indican un nivel funcional con margen de crecimiento. "
                "Puntajes de 1 a 4 reflejan insatisfacción o desequilibrio, señalando áreas prioritarias de atención clínica."
            ),
            "promedio_actual": scores.get("promedio_actual", 0),
            "areas_fortaleza": scores.get("highest_dimensions", []),
            "areas_prioritarias": scores.get("lowest_dimensions", []),
            "creencias_predominantes": scores.get("highest_dimensions", []),
            "mayores_brechas": scores.get("highest_gaps", []),
            "dimensiones": scores.get("dimensions", []),
            "dimensiones_elevadas": [
                dimension
                for dimension in scores["dimensions"]
                if dimension["level"] in {"MODERADO", "ALTO"}
            ],
        }
        doc_name = test["name"]
    else:
        responses = normalize_responses(raw_responses)
        scores = evaluate_ellis(responses)
        interpretation = {
            "criterio": (
                "Puntajes de 5 o 6 sugieren una creencia limitante en determinadas "
                "circunstancias. Puntajes iguales o superiores a 7 sugieren una "
                "creencia limitante en muchas áreas de la vida."
            ),
            "dimensiones_elevadas": [
                dimension
                for dimension in scores["dimensions"]
                if dimension["level"] in {"MODERADO", "ALTO"}
            ],
        }
        doc_name = "Test de Creencias Ellis"

    with transaction.atomic():
        sesion = Sesion.objects.create(
            paciente=asignacion.paciente,
            psicologo=asignacion.psicologo,
            origen=Sesion.Origen.TEST_PSICOLOGICO,
            estado=Sesion.Estado.COMPLETADO,
            documento_nombre_original=doc_name,
            documento_mime_type="application/vnd.psiconex.test+json",
        )
        resultado = ResultadoEvaluacion.objects.create(
            asignacion=asignacion,
            respuestas=responses,
            puntajes=scores,
            interpretacion=interpretation,
        )
        asignacion.sesion = sesion
        asignacion.estado = EvaluacionAsignada.Estado.COMPLETADO
        asignacion.fecha_completado = timezone.now()
        asignacion.save(
            update_fields=["sesion", "estado", "fecha_completado", "updated_at"]
        )
        create_test_segments(sesion, resultado)

    observation, ia_status, ia_error = generate_ai_observation(asignacion, resultado)
    resultado.observacion_ia = sanitize_markdown_emphasis(observation)
    resultado.estado_ia = ia_status
    resultado.error_ia = ia_error
    resultado.save(update_fields=["observacion_ia", "estado_ia", "error_ia", "updated_at"])
    append_observation_segment(asignacion.sesion, resultado.observacion_ia)
    return resultado


def create_test_segments(sesion, resultado):
    TranscripcionSegmento.objects.filter(sesion=sesion).delete()
    parts = build_result_text_parts(resultado, include_observation=False)
    order = 1
    for part in parts:
        for chunk in split_text_into_segments(part, max_chars=1600):
            TranscripcionSegmento.objects.create(
                sesion=sesion,
                orden=order,
                inicio_segundo=order - 1,
                fin_segundo=order,
                hablante=TranscripcionSegmento.Hablante.DOCUMENTO,
                texto=chunk,
                texto_original=chunk,
                embedding=generate_text_embedding(chunk),
            )
            order += 1


def append_observation_segment(sesion, observation):
    if not observation:
        return
    last_order = (
        TranscripcionSegmento.objects.filter(sesion=sesion)
        .order_by("-orden")
        .values_list("orden", flat=True)
        .first()
        or 0
    )
    text = f"Observación IA\n\n{observation}"
    for offset, chunk in enumerate(split_text_into_segments(text, max_chars=1600), start=1):
        order = last_order + offset
        TranscripcionSegmento.objects.create(
            sesion=sesion,
            orden=order,
            inicio_segundo=order - 1,
            fin_segundo=order,
            hablante=TranscripcionSegmento.Hablante.DOCUMENTO,
            texto=chunk,
            texto_original=chunk,
            embedding=generate_text_embedding(chunk),
        )


def build_result_text_parts(resultado, include_observation=True):
    return [section["content"] for section in build_result_sections(resultado, include_observation)]


def build_result_sections(resultado, include_observation=True):
    test_slug = resultado.asignacion.test_slug
    test = get_test(test_slug) or get_test(ELLIS_SLUG)

    if test_slug in (RUEDA_VIDA_SLUG, RUEDA_CREENCIAS_SLUG):
        return build_rueda_result_sections(resultado, test, include_observation)
    return build_ellis_result_sections(resultado, test, include_observation)


def build_rueda_result_sections(resultado, test, include_observation=True):
    scores = resultado.puntajes
    interpretation = resultado.interpretacion
    title = f"Resultado - {test['name']}"

    fortalezas = interpretation.get("areas_fortaleza") or interpretation.get("creencias_predominantes", [])
    prioritarias = interpretation.get("areas_prioritarias") or scores.get("lowest_dimensions", [])

    summary_lines = [
        f"Promedio de satisfacción vital: {scores.get('promedio_actual', 0)} / 10",
        f"Puntaje total de bienestar: {scores.get('total_score', 0)} / 100",
        "",
        "ÁREAS DE MAYOR SATISFACCIÓN (FORTALEZAS VITALES):",
    ]
    for i, dim in enumerate(fortalezas, 1):
        summary_lines.append(
            f"{i}. {dim['name']}: {dim.get('score', dim.get('actual', 0))}/10 - {dim['label']}"
        )

    summary_lines.append("")
    summary_lines.append("ÁREAS PRIORITARIAS DE ATENCIÓN / MENOR SATISFACCIÓN:")
    for i, dim in enumerate(prioritarias, 1):
        summary_lines.append(
            f"{i}. {dim['name']}: {dim.get('score', dim.get('actual', 0))}/10 - {dim['label']}"
        )

    table_lines = [
        "EVALUACIÓN POR ÁREAS DE LA VIDA:",
        "N° | Área de la Vida | Nivel Actual (1-10) | Estado / Clasificación",
        "---|---|---|---",
    ]
    for dim in scores.get("dimensions", []):
        table_lines.append(
            f"{dim['id']} | {dim['name']} | {dim.get('score', dim.get('actual', 0))}/10 | {dim['label']}"
        )

    detail_lines = [
        interpretation.get("criterio", ""),
        "",
        "DETALLE POR ÁREA Y PREGUNTA CLÍNICA:",
    ]
    for dim in scores.get("dimensions", []):
        detail_lines.append(
            f"{dim['id']}. {dim['name']} ({dim.get('score', dim.get('actual', 0))}/10):\n"
            f"   Pregunta: \"{dim.get('phrase', '')}\"\n"
            f"   Ámbito: {dim.get('description', '')}\n"
            f"   Clasificación: {dim['label']}\n"
        )

    sections = [
        {
            "key": "resumen_rueda",
            "title": title,
            "document_title": "Resumen y Áreas Vitales",
            "content": "\n".join(summary_lines),
        },
        {
            "key": "tabla_rueda",
            "title": title,
            "document_title": "Tabla de Puntuaciones por Área",
            "content": "\n".join(table_lines),
        },
        {
            "key": "detalle_creencias",
            "title": title,
            "document_title": "Detalle Clínico por Área",
            "content": "\n".join(detail_lines),
        },
    ]
    if include_observation and resultado.observacion_ia:
        sections.append(
            {
                "key": "observacion_ia",
                "title": title,
                "document_title": "Observación IA",
                "content": sanitize_markdown_emphasis(resultado.observacion_ia),
            }
        )
    return sections


def build_ellis_result_sections(resultado, test, include_observation=True):
    question_map = {question["id"]: question for question in test["questions"]}
    response_labels = {
        DE_ACUERDO: "De acuerdo",
        NO_DE_ACUERDO: "No estoy de acuerdo",
    }

    scores = resultado.puntajes
    elevated = resultado.interpretacion.get("dimensiones_elevadas", [])
    title = f"Resultado del test - {test['name']}"
    summary_lines = [
        f"Puntaje total: {scores.get('total_score', 0)} / {scores.get('max_score', 100)}",
        "",
        "Puntajes por dimensión:",
    ]
    for dimension in scores.get("dimensions", []):
        summary_lines.append(
            f"{dimension['id']}. {dimension['name']}: {dimension['score']}/10 - {dimension['label']}"
        )

    interpretation_lines = [
        resultado.interpretacion.get("criterio", ""),
        "",
        "Dimensiones elevadas:",
    ]
    if elevated:
        for dimension in elevated:
            interpretation_lines.append(
                f"{dimension['name']} ({dimension['score']}/10): {dimension['belief']}"
            )
    else:
        interpretation_lines.append("No se observan dimensiones elevadas según el criterio de puntuación del instrumento.")

    response_lines = []
    for question_id in sorted(question_map):
        response = resultado.respuestas.get(str(question_id), "")
        response_lines.append(
            f"{question_id}. {question_map[question_id]['text']} - {response_labels.get(response, response)}"
        )

    sections = [
        {
            "key": "respuestas",
            "title": title,
            "document_title": "Respuestas paciente",
            "content": "\n".join(response_lines),
        },
        {
            "key": "puntajes",
            "title": title,
            "document_title": "Puntajes",
            "content": "\n".join(summary_lines),
        },
        {
            "key": "interpretacion",
            "title": title,
            "document_title": "Interpretación",
            "content": "\n".join(interpretation_lines),
        },
    ]
    if include_observation and resultado.observacion_ia:
        sections.append(
            {
                "key": "observacion_ia",
                "title": title,
                "document_title": "Observación IA",
                "content": sanitize_markdown_emphasis(resultado.observacion_ia),
            }
        )
    return sections


def build_ai_prompt_context(asignacion, resultado):
    paciente = asignacion.paciente
    patient_lines = [
        f"Nombre paciente: {paciente.nombre_completo}",
        f"Edad: {paciente.edad} años" if paciente.edad else "",
        f"Sexo: {paciente.get_sexo_display()}" if paciente.sexo else "",
        f"Motivo de consulta: {paciente.motivo_consulta}",
        f"Objetivos de intervención: {paciente.objetivos_intervencion}",
        f"Diagnóstico sospechado registrado por profesional: {paciente.diagnostico_sospechado}",
        f"Medicación actual: {paciente.medicacion_actual}",
    ]
    patient_context = "\n".join(line for line in patient_lines if line)
    result_context = "\n\n".join(build_result_text_parts(resultado, include_observation=False))
    dsm_context = retrieve_dsm_context(result_context)
    return patient_context, result_context, dsm_context


def generate_ai_observation(asignacion, resultado):
    if not settings.DEEPSEEK_API_KEY:
        return (
            "Observación IA no generada porque DEEPSEEK_API_KEY no está configurada. "
            "Los puntajes del test quedaron guardados para revisión clínica del profesional.",
            ResultadoEvaluacion.EstadoIA.SIN_CONFIGURACION,
            "DEEPSEEK_API_KEY no configurada",
        )

    patient_context, result_context, dsm_context = build_ai_prompt_context(asignacion, resultado)
    system_prompt = (
        "Eres un asistente clínico de apoyo para psicólogos. Usa un lenguaje prudente, "
        "profesional y en español. No entregues diagnósticos definitivos ni reemplaces "
        "el criterio clínico. Diferencia evidencia del test, hipótesis clínicas y límites "
        "de la interpretación. Usa el DSM-5 solo como marco de apoyo para orientar áreas "
        "a explorar, no para diagnosticar automáticamente."
    )
    test = get_test(asignacion.test_slug)
    test_name = test["name"] if test else "Test Psicológico"

    if asignacion.test_slug in (RUEDA_VIDA_SLUG, RUEDA_CREENCIAS_SLUG):
        user_prompt = (
            f"Genera una observación clínica breve y estructurada basada en la {test_name} (Evaluación sistémica de satisfacción vital en 10 áreas clave).\n\n"
            f"Contexto del paciente:\n{patient_context}\n\n"
            f"Resultados de la Rueda de la Vida:\n{result_context}\n\n"
            f"Extractos DSM-5 de apoyo disponibles:\n{dsm_context or 'No se encontró contexto DSM-5 disponible.'}\n\n"
            "Estructura la respuesta con los siguientes apartados:\n"
            "SÍNTESIS DEL EQUILIBRIO VITAL (Analiza el nivel promedio y el balance global de satisfacción en las 10 áreas);\n"
            "ÁREAS DE FORTALEZA Y RECURSOS (Identifica las dimensiones con mayor puntaje que sirven como anclaje resiliente);\n"
            "ÁREAS DE VULNERABILIDAD O PRIORITARIAS (Focos de insatisfacción o desequilibrio que demandan intervención inmediata);\n"
            "RELACIÓN CON EL MOTIVO DE CONSULTA (Cómo se articulan estas áreas con la sintomatología o demandas del paciente);\n"
            "RECOMENDACIONES PARA EL TRABAJO TERAPÉUTICO (Estrategias y metas concretas para las próximas sesiones);\n"
            "LÍMITES DE LA OBSERVACIÓN.\n"
            "No uses Markdown ni asteriscos. Si necesitas títulos, escríbelos en mayúsculas."
        )
    else:
        user_prompt = (
            "Genera una observación clínica breve basada en el Test de Creencias Ellis.\n\n"
            f"Contexto del paciente:\n{patient_context}\n\n"
            f"Resultados del test:\n{result_context}\n\n"
            f"Extractos DSM-5 de apoyo disponibles:\n{dsm_context or 'No se encontró contexto DSM-5 disponible.'}\n\n"
            "Estructura la respuesta con: Síntesis del resultado; Áreas a explorar; "
            "Relación prudente con criterios DSM-5; Recomendaciones para próxima sesión; "
            "Límites de la observación. No uses Markdown ni asteriscos. Si necesitas títulos, "
            "escríbelos en mayúsculas."
        )

    try:
        response = requests.post(
            f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.25,
                "max_tokens": 1800,
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        return (
            sanitize_markdown_emphasis(data["choices"][0]["message"]["content"]),
            ResultadoEvaluacion.EstadoIA.GENERADA,
            "",
        )
    except Exception as exc:
        return (
            "Observación IA no generada por un error al consultar el modelo. "
            "Los puntajes y respuestas del test quedaron guardados para revisión clínica.",
            ResultadoEvaluacion.EstadoIA.ERROR,
            str(exc),
        )


def retrieve_dsm_context(query, max_chunks=4):
    chunks = load_dsm_chunks()
    if not chunks:
        return ""
    query_terms = set(TOKEN_RE.findall((query or "").lower()))
    ranked = []
    for chunk in chunks:
        chunk_lower = chunk.lower()
        score = sum(1 for term in query_terms if term and term in chunk_lower)
        if score:
            ranked.append((score, chunk))
    ranked.sort(key=lambda item: item[0], reverse=True)
    selected = [chunk for _, chunk in ranked[:max_chunks]] or chunks[:max_chunks]
    return "\n\n---\n\n".join(selected)


@lru_cache(maxsize=1)
def load_dsm_chunks():
    path = getattr(settings, "DSM5_DOCUMENT_PATH", "")
    if not path or not os.path.exists(path):
        return []
    try:
        from pypdf import PdfReader

        reader = PdfReader(path)
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text.strip())
        return split_text_into_segments("\n\n".join(pages), max_chars=1800)
    except Exception:
        return []
