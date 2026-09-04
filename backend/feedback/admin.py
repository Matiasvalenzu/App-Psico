from django.contrib import admin
from .models import FeedbackReport


@admin.register(FeedbackReport)
class FeedbackReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tipo",
        "modulo",
        "severidad",
        "titulo",
        "usuario",
        "estado",
        "created_at",
        "resuelto_at",
    )
    list_filter = ("estado", "tipo", "modulo", "severidad", "created_at")
    search_fields = (
        "titulo",
        "descripcion",
        "pasos_reproducir",
        "usuario__username",
        "usuario__email",
        "usuario__first_name",
        "usuario__last_name",
    )
    readonly_fields = (
        "usuario",
        "url_origen",
        "user_agent",
        "resolucion_pantalla",
        "created_at",
        "updated_at",
        "resuelto_at",
    )
    ordering = ("-created_at",)
