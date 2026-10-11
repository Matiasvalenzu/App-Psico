"""Generación de documentos exportables de un informe IA."""
import re
from io import BytesIO


def sanitize_markdown_emphasis(text):
    text = text or ""

    def uppercase_match(match):
        return match.group(1).strip().upper()

    text = re.sub(r"\*\*([^*]+)\*\*", uppercase_match, text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    return text.replace("**", "").strip()


def pdf_informe(informe):
    """Devuelve el informe en PDF como bytes."""
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

    draw_line(informe.titulo or informe.get_tipo_display(), "Helvetica-Bold", 16, 22)
    draw_line(f"Paciente: {informe.paciente.nombre_completo}")
    draw_line(f"Tipo: {informe.get_tipo_display()}")
    draw_line(f"Fecha: {informe.created_at.strftime('%d/%m/%Y %H:%M')}")
    y -= 8
    draw_line("Contenido", "Helvetica-Bold", 12, 18)

    for raw_line in sanitize_markdown_emphasis(informe.contenido).splitlines() or [""]:
        words = raw_line.split()
        if not words:
            draw_line("")
            continue
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
