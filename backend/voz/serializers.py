from rest_framework import serializers
from .models import VoiceProfile


class VoiceProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceProfile
        fields = ["id", "fecha_creacion", "activo"]
        read_only_fields = ["id", "fecha_creacion"]


class VoiceEnrollSerializer(serializers.Serializer):
    samples = serializers.ListField(
        child=serializers.FileField(),
        min_length=3,
        max_length=5,
        help_text="3-5 archivos WAV de ~5 segundos cada uno",
    )
