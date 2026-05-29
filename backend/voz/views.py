import logging

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import VoiceProfile
from .serializers import VoiceProfileSerializer, VoiceEnrollSerializer
from .services import average_embeddings, extract_voice_embedding_and_duration_from_upload


logger = logging.getLogger(__name__)


class VoiceProfileViewSet(viewsets.ModelViewSet):
    queryset = VoiceProfile.objects.all()
    serializer_class = VoiceProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return VoiceProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=["post"])
    def enroll(self, request):
        samples = request.FILES.getlist("samples")
        serializer = VoiceEnrollSerializer(data={"samples": samples})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        samples = serializer.validated_data["samples"]
        embeddings = []
        total_duration = 0.0

        for sample in samples:
            try:
                embedding, duration = self._extract_embedding(sample)
            except Exception as exc:
                logger.exception("No se pudo extraer embedding ECAPA de una muestra: %s", exc)
                embedding = None
                duration = 0.0
            if embedding:
                embeddings.append(embedding)
                total_duration += duration

        if not embeddings:
            return Response(
                {
                    "error": (
                        "No se pudo extraer embeddings ECAPA de las muestras. "
                        "Verifica que las grabaciones tengan voz clara y duren al menos unos segundos."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        avg_embedding = average_embeddings(embeddings)

        profile, created = VoiceProfile.objects.update_or_create(
            user=request.user,
            defaults={
                "embedding_vector": avg_embedding,
                "embedding_model": settings.SPEAKER_EMBEDDING_MODEL,
                "embedding_dim": len(avg_embedding),
                "sample_count": len(embeddings),
                "sample_duration_seconds": total_duration,
                "activo": True,
            },
        )

        return Response(VoiceProfileSerializer(profile).data)

    def _extract_embedding(self, audio_file):
        return extract_voice_embedding_and_duration_from_upload(audio_file)
