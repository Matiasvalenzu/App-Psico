import os
from io import BytesIO
from django.conf import settings
from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .embeddings import generate_text_embedding
from .models import Sesion, TranscripcionSegmento
from .serializers import (
    SesionSerializer,
    SesionListSerializer,
    AudioUploadSerializer,
    TranscripcionSegmentoSerializer,
)


class SesionViewSet(viewsets.ModelViewSet):
    queryset = Sesion.objects.select_related("paciente").prefetch_related("segmentos")

    def get_serializer_class(self):
        if self.action == "list":
            return SesionListSerializer
        return SesionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        paciente_id = self.request.query_params.get("paciente")
        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        return qs

    @action(detail=True, methods=["post"])
    def upload_audio(self, request, pk=None):
        sesion = self.get_object()
        serializer = AudioUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        audio_file = serializer.validated_data["audio"]
        duracion = serializer.validated_data.get("duracion_segundos", 0)

        audio_dir = os.path.join(settings.AUDIO_STORAGE_PATH, str(sesion.paciente_id))
        os.makedirs(audio_dir, exist_ok=True)

        _, extension = os.path.splitext(getattr(audio_file, "name", ""))
        extension = extension.lower() if extension else ".webm"
        if extension not in [".webm", ".wav", ".mp3", ".m4a", ".ogg"]:
            extension = ".webm"

        filename = f"{sesion.id}{extension}"
        filepath = os.path.join(audio_dir, filename)

        with open(filepath, "wb") as f:
            for chunk in audio_file.chunks():
                f.write(chunk)

        sesion.audio_path = filepath
        sesion.duracion_segundos = duracion
        sesion.estado = Sesion.Estado.PROCESANDO
        sesion.save()

        # Disparamos la tarea de procesamiento en segundo plano
        from .tasks import procesar_audio_sesion
        procesar_audio_sesion.delay(sesion.id)

        return Response(SesionSerializer(sesion).data)

    @action(detail=True, methods=["patch"], url_path=r"segmentos/(?P<segmento_id>[^/.]+)")
    def actualizar_segmento(self, request, pk=None, segmento_id=None):
        sesion = self.get_object()
        try:
            segmento = sesion.segmentos.get(id=segmento_id)
        except TranscripcionSegmento.DoesNotExist:
            return Response(
                {"error": "Segmento no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        texto = request.data.get("texto")
        hablante = request.data.get("hablante")

        if texto is not None:
            if not segmento.texto_original:
                segmento.texto_original = segmento.texto
            segmento.texto = texto
            segmento.embedding = generate_text_embedding(texto)

        if hablante is not None:
            valid_hablantes = {choice[0] for choice in TranscripcionSegmento.Hablante.choices}
            if hablante not in valid_hablantes:
                return Response(
                    {"error": "Hablante inválido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            segmento.hablante = hablante

        segmento.save()
        return Response(TranscripcionSegmentoSerializer(segmento).data)

    @action(detail=True, methods=["get"])
    def exportar_pdf(self, request, pk=None):
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        sesion = self.get_object()
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

        draw_line("Reporte de sesión psicológica", "Helvetica-Bold", 16, 22)
        draw_line(f"Paciente: {sesion.paciente.nombre_completo}")
        draw_line(f"Fecha: {sesion.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')}")
        draw_line(f"Estado: {sesion.estado}")
        if sesion.duracion_segundos:
            draw_line(f"Duración: {sesion.duracion_segundos} segundos")

        if sesion.notas_sesion:
            y -= 8
            draw_line("Notas del psicólogo", "Helvetica-Bold", 12, 18)
            for line in sesion.notas_sesion.splitlines():
                draw_line(line)

        y -= 8
        draw_line("Transcripción", "Helvetica-Bold", 12, 18)
        for segmento in sesion.segmentos.all():
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
        buffer.seek(0)
        filename = f"sesion-{sesion.id}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)
