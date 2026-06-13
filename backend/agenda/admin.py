from django.contrib import admin

from .models import AgendaCita, AgendaGoogleCalendarConnection


@admin.register(AgendaCita)
class AgendaCitaAdmin(admin.ModelAdmin):
    list_display = ["contacto", "psicologo", "inicio", "fin", "estado", "recurrencia"]
    list_filter = ["estado", "recurrencia", "inicio"]
    search_fields = [
        "paciente__nombre",
        "paciente__apellido",
        "prospecto_nombre",
        "prospecto_apellido",
        "psicologo__username",
    ]
    ordering = ["-inicio"]

    def contacto(self, obj):
        return obj.paciente or f"{obj.prospecto_nombre} {obj.prospecto_apellido}".strip()


@admin.register(AgendaGoogleCalendarConnection)
class AgendaGoogleCalendarConnectionAdmin(admin.ModelAdmin):
    list_display = ["psicologo", "calendar_name", "calendar_id", "last_synced_at", "updated_at"]
    search_fields = ["psicologo__username", "calendar_name", "calendar_id"]
    readonly_fields = ["access_token", "refresh_token"]
