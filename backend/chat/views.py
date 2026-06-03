import requests
from django.conf import settings
from django.db.models import Count
from pgvector.django import CosineDistance
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from pacientes.models import Paciente
from sesiones.embeddings import cosine_similarity, generate_text_embedding
from sesiones.models import Sesion, TranscripcionSegmento
from .models import ChatConversacion, ChatMensaje
from .serializers import (
    ChatConversacionSerializer,
    ChatConversacionListSerializer,
    ChatMensajeSerializer,
)


class ChatConversacionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return ChatConversacionListSerializer
        return ChatConversacionSerializer

    def get_queryset(self):
        qs = (
            ChatConversacion.objects.filter(psicologo=self.request.user)
            .select_related("paciente", "psicologo")
            .prefetch_related("mensajes")
            .annotate(mensajes_count=Count("mensajes"))
        )
        paciente_id = self.request.query_params.get("paciente")
        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        return qs

    def perform_create(self, serializer):
        titulo = (serializer.validated_data.get("titulo") or "").strip()
        serializer.save(
            psicologo=self.request.user,
            titulo=titulo or "Nueva conversación",
        )

    @action(detail=True, methods=["post"])
    def enviar_mensaje(self, request, pk=None):
        conversacion = self.get_object()
        contenido = request.data.get("contenido", "")

        if not contenido:
            return Response(
                {"error": "El contenido es requerido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ChatMensaje.objects.create(
            conversacion=conversacion,
            rol=ChatMensaje.Rol.USER,
            contenido=contenido,
        )

        if conversacion.titulo in {"", "Nueva conversación"}:
            conversacion.titulo = self._titulo_desde_mensaje(contenido)
            conversacion.save(update_fields=["titulo", "updated_at"])
        else:
            conversacion.save(update_fields=["updated_at"])

        contexto, fuentes = self._buscar_contexto(conversacion.paciente, contenido)
        respuesta = self._consultar_deepseek(contenido, contexto)

        mensaje_asistente = ChatMensaje.objects.create(
            conversacion=conversacion,
            rol=ChatMensaje.Rol.ASSISTANT,
            contenido=respuesta,
            fuentes_json=fuentes,
        )

        return Response(ChatMensajeSerializer(mensaje_asistente).data)

    def _titulo_desde_mensaje(self, contenido):
        titulo = " ".join(contenido.split())[:80].strip()
        if not titulo:
            return "Nueva conversación"
        return f"{titulo}..." if len(contenido) > 80 else titulo

    def _buscar_contexto(self, paciente, consulta, top_k=15):
        query_embedding = generate_text_embedding(consulta)
        base_qs = TranscripcionSegmento.objects.filter(
            sesion__paciente=paciente
        ).select_related("sesion")

        try:
            segmentos = list(
                base_qs.exclude(embedding__isnull=True)
                .annotate(distance=CosineDistance("embedding", query_embedding))
                .order_by("distance")[: top_k * 5]
            )
        except Exception:
            segmentos = []

        if not segmentos:
            candidatos = list(base_qs.exclude(embedding__isnull=True)[:100])
            candidatos.sort(
                key=lambda seg: cosine_similarity(query_embedding, seg.embedding or []),
                reverse=True,
            )
            segmentos = candidatos[: top_k * 5]

        if not segmentos:
            segmentos = list(base_qs[: top_k * 5])

        seen_sessions = {}
        diversified = []
        for seg in segmentos:
            sid = seg.sesion_id
            if sid not in seen_sessions:
                seen_sessions[sid] = seg
                diversified.append(seg)
                if len(diversified) >= top_k:
                    break

        remaining = top_k - len(diversified)
        if remaining > 0:
            for seg in segmentos:
                if seg not in diversified:
                    diversified.append(seg)
                    if len(diversified) >= top_k:
                        break

        contexto = []
        fuentes = []
        for seg in diversified:
            fecha = seg.sesion.fecha_hora_inicio.strftime("%d/%m/%Y")
            if seg.sesion.origen == Sesion.Origen.DOCUMENTO_EXTERNO:
                etiqueta = f"Documento externo {fecha}"
                if seg.sesion.documento_nombre_original:
                    etiqueta = f"{etiqueta} - {seg.sesion.documento_nombre_original}"
                contexto.append(f"[{etiqueta}]: {seg.texto}")
            else:
                contexto.append(
                    f"[Sesión {fecha} - {seg.hablante}]: {seg.texto}"
                )
            fuentes.append(
                {
                    "segmento_id": seg.id,
                    "sesion_id": seg.sesion_id,
                    "fecha": fecha,
                    "origen": seg.sesion.origen,
                    "documento_nombre_original": seg.sesion.documento_nombre_original,
                    "hablante": seg.hablante,
                    "texto": seg.texto[:240],
                }
            )

        return "\n".join(contexto), fuentes

    def _consultar_deepseek(self, pregunta, contexto):
        if not settings.DEEPSEEK_API_KEY:
            return "API de DeepSeek no configurada. Configura DEEPSEEK_API_KEY en el entorno."

        system_prompt = (
            "Eres un asistente especializado para psicólogos clínicos. "
            "Analiza los fragmentos de sesiones proporcionados y responde "
            "la pregunta del psicólogo en español. "
            "Cita las fechas de sesión cuando sea relevante. "
            "Si la información no es suficiente para responder, indícalo claramente. "
            "Mantén un tono profesional y objetivo."
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
                        {
                            "role": "user",
                            "content": f"Contexto de sesiones:\n{contexto}\n\nPregunta: {pregunta}",
                        },
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000,
                },
                timeout=60,
            )
            data = response.json()
            respuesta = data["choices"][0]["message"]["content"]
            return respuesta
        except Exception as e:
            return f"Error al consultar DeepSeek: {str(e)}"
