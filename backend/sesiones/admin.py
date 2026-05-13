from django.contrib import admin
from .models import Sesion, TranscripcionSegmento


@admin.register(Sesion)
class SesionAdmin(admin.ModelAdmin):
    list_display = ["paciente", "fecha_hora_inicio", "estado", "duracion_segundos"]
    list_filter = ["estado", "fecha_hora_inicio"]
    search_fields = ["paciente__nombre", "paciente__apellido"]


@admin.register(TranscripcionSegmento)
class TranscripcionSegmentoAdmin(admin.ModelAdmin):
    list_display = ["sesion", "orden", "hablante", "inicio_segundo", "texto_truncado"]
    list_filter = ["hablante"]

    def texto_truncado(self, obj):
        return obj.texto[:80]
