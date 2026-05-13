from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import VoiceProfile
from .serializers import VoiceProfileSerializer, VoiceEnrollSerializer
from .services import average_embeddings, extract_voice_embedding_from_upload


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

        for sample in samples:
            try:
                embedding = self._extract_embedding(sample)
            except Exception:
                embedding = None
            if embedding:
                embeddings.append(embedding)

        if not embeddings:
            return Response(
                {"error": "No se pudo extraer embeddings de las muestras"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        avg_embedding = average_embeddings(embeddings)

        profile, created = VoiceProfile.objects.update_or_create(
            user=request.user,
            defaults={"embedding_vector": avg_embedding, "activo": True},
        )

        return Response(VoiceProfileSerializer(profile).data)

    def _extract_embedding(self, audio_file):
        return extract_voice_embedding_from_upload(audio_file)
