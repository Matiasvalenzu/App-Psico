from django.contrib import admin
from .models import Sesion, SpeakerIdentificationResult, TranscripcionSegmento


@admin.register(Sesion)
class SesionAdmin(admin.ModelAdmin):
    list_display = ["paciente", "psicologo", "fecha_hora_inicio", "estado", "duracion_segundos"]
    list_filter = ["estado", "origen", "fecha_hora_inicio"]
    search_fields = ["paciente__nombre", "paciente__apellido"]


@admin.register(TranscripcionSegmento)
class TranscripcionSegmentoAdmin(admin.ModelAdmin):
    list_display = [
        "sesion",
        "orden",
        "hablante",
        "speaker_label",
        "speaker_match_score",
        "inicio_segundo",
        "texto_truncado",
    ]
    list_filter = ["hablante"]

    def texto_truncado(self, obj):
        return obj.texto[:80]


@admin.register(SpeakerIdentificationResult)
class SpeakerIdentificationResultAdmin(admin.ModelAdmin):
    list_display = [
        "sesion",
        "pyannote_label",
        "assigned_hablante",
        "score",
        "threshold",
        "reason",
    ]
    list_filter = ["assigned_hablante", "reason", "model_name"]
