from django.contrib import admin

from .models import EvaluacionAsignada, ResultadoEvaluacion


@admin.register(EvaluacionAsignada)
class EvaluacionAsignadaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "test_slug",
        "paciente",
        "psicologo",
        "estado",
        "email_destino",
        "fecha_expiracion",
        "created_at",
    )
    list_filter = ("estado", "test_slug", "email_enviado")
    search_fields = ("paciente__nombre", "paciente__apellido", "email_destino")
    readonly_fields = ("token_hash", "enlace_generado", "created_at", "updated_at")


@admin.register(ResultadoEvaluacion)
class ResultadoEvaluacionAdmin(admin.ModelAdmin):
    list_display = ("id", "asignacion", "estado_ia", "created_at")
    list_filter = ("estado_ia",)
    readonly_fields = ("created_at", "updated_at")
