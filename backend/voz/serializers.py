from rest_framework import serializers
from .models import VoiceProfile


class VoiceProfileSerializer(serializers.ModelSerializer):
    compatible = serializers.BooleanField(source="is_compatible", read_only=True)

    class Meta:
        model = VoiceProfile
        fields = [
            "id",
            "fecha_creacion",
            "updated_at",
            "activo",
            "embedding_model",
            "embedding_dim",
            "sample_count",
            "sample_duration_seconds",
            "compatible",
        ]
        read_only_fields = fields


class VoiceEnrollSerializer(serializers.Serializer):
    samples = serializers.ListField(
        child=serializers.FileField(),
        min_length=3,
        max_length=5,
        help_text="3-5 archivos WAV de ~5 segundos cada uno",
    )
