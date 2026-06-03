import os
from io import BytesIO
from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .documentos import (
    DocumentTextExtractionError,
    UnsupportedDocumentType,
    extract_text_from_uploaded_document,
    split_text_into_segments,
)
from .embeddings import generate_text_embedding
from .models import Sesion, TranscripcionSegmento
from .serializers import (
    SesionSerializer,
    SesionListSerializer,
    AudioUploadSerializer,
    DocumentoUploadSerializer,
    TranscripcionSegmentoSerializer,
)


class SesionViewSet(viewsets.ModelViewSet):
    queryset = Sesion.objects.select_related("paciente", "psicologo").prefetch_related(
        "segmentos",
        "speaker_results",
    )

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

    def perform_create(self, serializer):
        serializer.save(psicologo=self.request.user)

    @action(detail=True, methods=["post"])
    def upload_audio(self, request, pk=None):
        sesion = self.get_object()
        if sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO:
            return Response(
                {"error": "No se puede agregar audio a un documento externo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
        if sesion.psicologo_id is None:
            sesion.psicologo = request.user
        sesion.save()

        # Disparamos la tarea de procesamiento en segundo plano
        from .tasks import procesar_audio_sesion
        procesar_audio_sesion.delay(sesion.id)

        return Response(SesionSerializer(sesion).data)

    @action(detail=False, methods=["post"], url_path="upload_documento")
    def upload_documento(self, request):
        serializer = DocumentoUploadSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        archivo = serializer.validated_data["archivo"]
        try:
            texto = extract_text_from_uploaded_document(archivo)
        except (UnsupportedDocumentType, DocumentTextExtractionError) as exc:
            return Response(
                {"archivo": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not texto.strip():
            return Response(
                {
                    "archivo": [
                        "No se encontró texto seleccionable en el documento."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        segmentos_texto = split_text_into_segments(texto)
        with transaction.atomic():
            sesion = Sesion.objects.create(
                paciente=serializer.validated_data["paciente"],
                psicologo=request.user,
                fecha_hora_inicio=serializer.validated_data["fecha_hora_inicio"],
                origen=Sesion.Origen.DOCUMENTO_EXTERNO,
                estado=Sesion.Estado.COMPLETADO,
                documento_nombre_original=getattr(archivo, "name", ""),
                documento_mime_type=getattr(archivo, "content_type", ""),
            )

            for index, segmento_texto in enumerate(segmentos_texto, start=1):
                TranscripcionSegmento.objects.create(
                    sesion=sesion,
                    orden=index,
                    inicio_segundo=index - 1,
                    fin_segundo=index,
                    hablante=TranscripcionSegmento.Hablante.DOCUMENTO,
                    texto=segmento_texto,
                    texto_original=segmento_texto,
                    embedding=generate_text_embedding(segmento_texto),
                )

        sesion = self.get_queryset().get(id=sesion.id)
        return Response(SesionSerializer(sesion).data, status=status.HTTP_201_CREATED)

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

    @action(detail=False, methods=["post"], url_path="crear_virtual")
    def crear_virtual(self, request):
        paciente_id = request.data.get("paciente")
        plataforma = request.data.get("plataforma")
        url_reunion = request.data.get("url_reunion", "")
        fecha_hora_inicio = request.data.get("fecha_hora_inicio")

        if not paciente_id:
            return Response({"error": "El campo paciente es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        if plataforma not in [Sesion.Plataforma.GOOGLE_MEET, Sesion.Plataforma.ZOOM]:
            return Response({"error": "Plataforma inválida. Usa GOOGLE_MEET o ZOOM."}, status=status.HTTP_400_BAD_REQUEST)

        from pacientes.models import Paciente
        try:
            paciente = Paciente.objects.get(id=paciente_id, psicologo=request.user)
        except Paciente.DoesNotExist:
            return Response({"error": "Paciente no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        create_kwargs = dict(
            paciente=paciente,
            psicologo=request.user,
            origen=Sesion.Origen.VIRTUAL,
            plataforma_virtual=plataforma,
            url_reunion=url_reunion or None,
            estado=Sesion.Estado.PENDIENTE,
        )
        if fecha_hora_inicio:
            from django.utils.dateparse import parse_datetime
            dt = parse_datetime(fecha_hora_inicio)
            if dt:
                create_kwargs["fecha_hora_inicio"] = dt

        sesion = Sesion.objects.create(**create_kwargs)
        return Response(SesionSerializer(self.get_queryset().get(id=sesion.id)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="caption")
    def caption(self, request, pk=None):
        chunks = request.data if isinstance(request.data, list) else request.data.get("chunks", [])
        if not isinstance(chunks, list) or not chunks:
            return Response({"error": "Se esperaba una lista de chunks."}, status=status.HTTP_400_BAD_REQUEST)

        valid = []
        for chunk in chunks:
            if isinstance(chunk, dict) and chunk.get("speaker_name") and chunk.get("texto"):
                valid.append({
                    "speaker_name": str(chunk["speaker_name"])[:200],
                    "texto": str(chunk["texto"])[:2000],
                    "timestamp_seconds": float(chunk.get("timestamp_seconds", 0)),
                })
        if not valid:
            return Response({"received": 0})

        with transaction.atomic():
            sesion = Sesion.objects.select_for_update().filter(
                pk=pk, psicologo=request.user, origen=Sesion.Origen.VIRTUAL
            ).first()
            if not sesion:
                return Response({"error": "Sesión virtual no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            if sesion.estado == Sesion.Estado.COMPLETADO:
                return Response({"error": "La sesión ya fue finalizada."}, status=status.HTTP_400_BAD_REQUEST)

            buffer = sesion.captions_buffer or []
            buffer.extend(valid)
            sesion.captions_buffer = buffer
            sesion.save(update_fields=["captions_buffer", "updated_at"])

        return Response({"received": len(valid), "total": len(buffer)})

    @action(detail=True, methods=["get"], url_path="caption_count")
    def caption_count(self, request, pk=None):
        sesion = self.get_object()
        buffer = sesion.captions_buffer or []
        speakers = list({c["speaker_name"] for c in buffer if isinstance(c, dict) and c.get("speaker_name")})
        return Response({"count": len(buffer), "speakers": speakers, "estado": sesion.estado})

    @action(detail=True, methods=["post"], url_path="finalizar_virtual")
    def finalizar_virtual(self, request, pk=None):
        nombre_psicologo = request.data.get("nombre_psicologo", "").strip()
        nombre_paciente = request.data.get("nombre_paciente", "").strip()

        with transaction.atomic():
            sesion = Sesion.objects.select_for_update().filter(
                pk=pk, psicologo=request.user, origen=Sesion.Origen.VIRTUAL
            ).first()
            if not sesion:
                return Response({"error": "Sesión virtual no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            if sesion.estado == Sesion.Estado.COMPLETADO:
                return Response({"error": "La sesión ya fue finalizada."}, status=status.HTTP_400_BAD_REQUEST)

            buffer = sesion.captions_buffer or []
            if not buffer:
                return Response({"error": "No hay captions capturados aún."}, status=status.HTTP_400_BAD_REQUEST)

            def resolver_hablante(speaker_name):
                name_lower = speaker_name.lower()
                if nombre_psicologo and nombre_psicologo.lower() in name_lower:
                    return TranscripcionSegmento.Hablante.PSICOLOGO
                if nombre_paciente and nombre_paciente.lower() in name_lower:
                    return TranscripcionSegmento.Hablante.PACIENTE
                return TranscripcionSegmento.Hablante.PACIENTE

            TranscripcionSegmento.objects.filter(sesion=sesion).delete()

            # Fusionar chunks consecutivos del mismo hablante
            merged = []
            for chunk in sorted(buffer, key=lambda c: c.get("timestamp_seconds", 0)):
                hablante = resolver_hablante(chunk["speaker_name"])
                if merged and merged[-1]["hablante"] == hablante and merged[-1]["speaker_name"] == chunk["speaker_name"]:
                    merged[-1]["texto"] += " " + chunk["texto"]
                    merged[-1]["fin"] = chunk["timestamp_seconds"] + 5
                else:
                    merged.append({
                        "speaker_name": chunk["speaker_name"],
                        "hablante": hablante,
                        "texto": chunk["texto"],
                        "inicio": chunk["timestamp_seconds"],
                        "fin": chunk["timestamp_seconds"] + 5,
                    })

            for index, seg in enumerate(merged, start=1):
                TranscripcionSegmento.objects.create(
                    sesion=sesion,
                    orden=index,
                    inicio_segundo=seg["inicio"],
                    fin_segundo=seg["fin"],
                    hablante=seg["hablante"],
                    speaker_label=seg["speaker_name"],
                    texto=seg["texto"],
                    texto_original=seg["texto"],
                    embedding=generate_text_embedding(seg["texto"]),
                )

            duracion = max(
                (c.get("timestamp_seconds", 0) for c in buffer), default=0
            )
            sesion.estado = Sesion.Estado.COMPLETADO
            sesion.duracion_segundos = int(duracion) + 5
            sesion.captions_buffer = []
            sesion.save(update_fields=["estado", "duracion_segundos", "captions_buffer", "updated_at"])

        return Response(SesionSerializer(self.get_queryset().get(id=sesion.id)).data)

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

        title = (
            "Documento externo cargado"
            if sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO
            else "Reporte de sesión psicológica"
        )
        draw_line(title, "Helvetica-Bold", 16, 22)
        draw_line(f"Paciente: {sesion.paciente.nombre_completo}")
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
            else "Transcripción"
        )
        draw_line(section_title, "Helvetica-Bold", 12, 18)
        for segmento in sesion.segmentos.all():
            if sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO:
                draw_line(f"Parte {segmento.orden}", "Helvetica-Bold")
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
        buffer.seek(0)
        filename = f"sesion-{sesion.id}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)
