from django.contrib import admin

from .models import NotificacionEmail


@admin.register(NotificacionEmail)
class NotificacionEmailAdmin(admin.ModelAdmin):
    list_display = ("tipo", "destinatario", "estado", "intentos", "enviada_at")
    list_filter = ("tipo", "estado")
    search_fields = ("destinatario", "clave_deduplicacion")
    readonly_fields = (
        "tipo",
        "destinatario",
        "responder_a",
        "clave_deduplicacion",
        "usuario",
        "cita",
        "evento_reserva",
        "estado",
        "intentos",
        "proximo_intento_at",
        "enviada_at",
        "ultimo_error",
        "created_at",
        "updated_at",
    )
