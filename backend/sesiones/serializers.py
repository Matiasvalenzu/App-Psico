from rest_framework import serializers
from django.conf import settings
from pacientes.models import Paciente
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
            "origen",
            "documento_nombre_original",
            "documento_mime_type",
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
            "origen",
            "documento_nombre_original",
            "documento_mime_type",
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
            "origen",
            "documento_nombre_original",
            "estado",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "fecha_hora_inicio",
            "origen",
            "documento_nombre_original",
            "estado",
            "created_at",
        ]


class AudioUploadSerializer(serializers.Serializer):
    audio = serializers.FileField()
    duracion_segundos = serializers.IntegerField(required=False, default=0)


class DocumentoUploadSerializer(serializers.Serializer):
    paciente = serializers.PrimaryKeyRelatedField(queryset=Paciente.objects.all())
    fecha_hora_inicio = serializers.DateTimeField()
    archivo = serializers.FileField()

    def validate_archivo(self, archivo):
        max_bytes = getattr(settings, "DOCUMENT_UPLOAD_MAX_BYTES", 10 * 1024 * 1024)
        if archivo.size > max_bytes:
            max_mb = max_bytes // (1024 * 1024)
            raise serializers.ValidationError(
                f"El archivo no puede superar {max_mb} MB."
            )
        return archivo
