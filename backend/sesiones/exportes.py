"""Generación de documentos exportables de una sesión."""
from io import BytesIO

from .models import Sesion


def pdf_sesion(sesion):
    """Devuelve el reporte PDF de la sesión como bytes."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 48

    def draw_line(text, font="Helvetica", size=10, leading=14):
        nonlocal y
        if y < 48:
            pdf.showPage()
            y = height - 48
        pdf.setFont(font, size)
        pdf.drawString(48, y, str(text)[:120])
        y -= leading

    title = (
        "Documento externo cargado"
        if sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO
        else "Resultado de test psicológico"
        if sesion.origen == Sesion.Origen.TEST_PSICOLOGICO
        else "Reporte de sesión psicológica"
    )
    draw_line(title, "Helvetica-Bold", 16, 22)
    draw_line(f"Paciente: {sesion.paciente.nombre_completo}")
    if sesion.numero_sesion:
        draw_line(f"Número de sesión: {sesion.numero_sesion}")
    draw_line(f"Fecha: {sesion.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')}")
    draw_line(f"Estado: {sesion.estado}")
    if sesion.documento_nombre_original:
        draw_line(f"Archivo: {sesion.documento_nombre_original}")
    if sesion.duracion_segundos:
        draw_line(f"Duración: {sesion.duracion_segundos} segundos")

    if sesion.notas_sesion:
        y -= 8
        draw_line("Notas del psicólogo", "Helvetica-Bold", 12, 18)
        for line in sesion.notas_sesion.splitlines():
            draw_line(line)

    y -= 8
    section_title = (
        "Contenido extraído"
        if sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO
        else "Resultado del test"
        if sesion.origen == Sesion.Origen.TEST_PSICOLOGICO
        else "Transcripción"
    )
    draw_line(section_title, "Helvetica-Bold", 12, 18)
    for segmento in sesion.segmentos.all():
        if sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO:
            draw_line(f"Parte {segmento.orden}", "Helvetica-Bold")
        elif sesion.origen == Sesion.Origen.TEST_PSICOLOGICO:
            draw_line(f"Sección {segmento.orden}", "Helvetica-Bold")
        else:
            draw_line(
                f"[{segmento.inicio_segundo:.1f}s-{segmento.fin_segundo:.1f}s] {segmento.hablante}",
                "Helvetica-Bold",
            )
        words = segmento.texto.split()
        line = ""
        for word in words:
            if len(line) + len(word) > 95:
                draw_line(line)
                line = word
            else:
                line = f"{line} {word}".strip()
        if line:
            draw_line(line)

    pdf.save()
    return buffer.getvalue()
