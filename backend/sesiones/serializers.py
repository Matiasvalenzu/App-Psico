from rest_framework import serializers
from .models import Sesion, TranscripcionSegmento


class TranscripcionSegmentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranscripcionSegmento
        fields = [
            "id",
            "orden",
            "inicio_segundo",
            "fin_segundo",
            "hablante",
            "texto",
            "texto_original",
        ]
        read_only_fields = ["id"]


class SesionSerializer(serializers.ModelSerializer):
    segmentos = TranscripcionSegmentoSerializer(many=True, read_only=True)
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)

    class Meta:
        model = Sesion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "fecha_hora_inicio",
            "duracion_segundos",
            "audio_path",
            "estado",
            "notas_sesion",
            "segmentos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "fecha_hora_inicio",
            "audio_path",
            "estado",
            "created_at",
            "updated_at",
        ]


class SesionListSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)

    class Meta:
        model = Sesion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "fecha_hora_inicio",
            "duracion_segundos",
            "estado",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "fecha_hora_inicio",
            "estado",
            "created_at",
        ]


class AudioUploadSerializer(serializers.Serializer):
    audio = serializers.FileField()
    duracion_segundos = serializers.IntegerField(required=False, default=0)
