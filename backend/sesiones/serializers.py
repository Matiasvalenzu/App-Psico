from rest_framework import serializers
from django.conf import settings
from pacientes.models import Paciente
from .models import Sesion, SpeakerIdentificationResult, TranscripcionSegmento


class TranscripcionSegmentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranscripcionSegmento
        fields = [
            "id",
            "orden",
            "inicio_segundo",
            "fin_segundo",
            "hablante",
            "speaker_label",
            "speaker_match_score",
            "speaker_match_threshold",
            "speaker_match_model",
            "texto",
            "texto_original",
        ]
        read_only_fields = ["id"]


class SpeakerIdentificationResultSerializer(serializers.ModelSerializer):
    matched_profile_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = SpeakerIdentificationResult
        fields = [
            "id",
            "pyannote_label",
            "matched_profile_id",
            "score",
            "threshold",
            "assigned_hablante",
            "total_duration_seconds",
            "turn_count",
            "model_name",
            "reason",
            "created_at",
        ]
        read_only_fields = fields


class SesionSerializer(serializers.ModelSerializer):
    segmentos = TranscripcionSegmentoSerializer(many=True, read_only=True)
    speaker_results = SpeakerIdentificationResultSerializer(many=True, read_only=True)
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    psicologo_username = serializers.CharField(source="psicologo.username", read_only=True)
    resultado_test = serializers.SerializerMethodField()

    class Meta:
        model = Sesion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "numero_sesion",
            "fecha_hora_inicio",
            "duracion_segundos",
            "audio_path",
            "origen",
            "plataforma_virtual",
            "url_reunion",
            "documento_nombre_original",
            "documento_mime_type",
            "estado",
            "notas_sesion",
            "segmentos",
            "speaker_results",
            "resultado_test",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "psicologo",
            "psicologo_username",
            "numero_sesion",
            "fecha_hora_inicio",
            "audio_path",
            "origen",
            "documento_nombre_original",
            "documento_mime_type",
            "estado",
            "created_at",
            "updated_at",
        ]

    def validate_paciente(self, paciente):
        request = self.context.get("request")
        if request and paciente.psicologo_id != request.user.id:
            raise serializers.ValidationError("Paciente no encontrado.")
        return paciente

    def get_resultado_test(self, obj):
        if obj.origen != Sesion.Origen.TEST_PSICOLOGICO:
            return None
        try:
            resultado = obj.evaluacion_asignada.resultado
        except Exception:
            return None

        from evaluaciones.services import build_result_sections

        return {
            "id": resultado.id,
            "test_slug": resultado.asignacion.test_slug,
            "test_nombre": obj.documento_nombre_original or "Test psicológico",
            "puntajes": resultado.puntajes,
            "interpretacion": resultado.interpretacion,
            "estado_ia": resultado.estado_ia,
            "secciones": build_result_sections(resultado, include_observation=True),
        }


class SesionListSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    psicologo_username = serializers.CharField(source="psicologo.username", read_only=True)

    class Meta:
        model = Sesion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "numero_sesion",
            "fecha_hora_inicio",
            "duracion_segundos",
            "origen",
            "plataforma_virtual",
            "url_reunion",
            "documento_nombre_original",
            "estado",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "psicologo",
            "psicologo_username",
            "numero_sesion",
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["paciente"].queryset = Paciente.objects.filter(
                psicologo=request.user
            )

    def validate_archivo(self, archivo):
        max_bytes = getattr(settings, "DOCUMENT_UPLOAD_MAX_BYTES", 10 * 1024 * 1024)
        if archivo.size > max_bytes:
            max_mb = max_bytes // (1024 * 1024)
            raise serializers.ValidationError(
                f"El archivo no puede superar {max_mb} MB."
            )
        return archivo
