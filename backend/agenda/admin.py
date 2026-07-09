from django.contrib import admin

from .models import (
    AgendaBloqueo,
    AgendaCita,
    AgendaDisponibilidad,
    AgendaGoogleCalendarConnection,
    AgendaPerfilPublico,
    AgendaReservaPublica,
)


@admin.register(AgendaCita)
class AgendaCitaAdmin(admin.ModelAdmin):
    list_display = ["contacto", "psicologo", "inicio", "fin", "estado", "origen_reserva", "recurrencia"]
    list_filter = ["estado", "origen_reserva", "recurrencia", "inicio"]
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


@admin.register(AgendaPerfilPublico)
class AgendaPerfilPublicoAdmin(admin.ModelAdmin):
    list_display = ["nombre_publico", "slug", "psicologo", "activo", "duracion_minutos", "acepta_pacientes_nuevos"]
    list_filter = ["activo", "acepta_pacientes_nuevos"]
    search_fields = ["nombre_publico", "slug", "psicologo__username"]
    prepopulated_fields = {"slug": ("nombre_publico",)}


@admin.register(AgendaDisponibilidad)
class AgendaDisponibilidadAdmin(admin.ModelAdmin):
    list_display = ["psicologo", "dia_semana", "hora_inicio", "hora_fin", "activo"]
    list_filter = ["dia_semana", "activo"]
    search_fields = ["psicologo__username"]


@admin.register(AgendaBloqueo)
class AgendaBloqueoAdmin(admin.ModelAdmin):
    list_display = ["psicologo", "inicio", "fin", "motivo"]
    list_filter = ["inicio"]
    search_fields = ["psicologo__username", "motivo"]


@admin.register(AgendaReservaPublica)
class AgendaReservaPublicaAdmin(admin.ModelAdmin):
    list_display = ["cita", "paciente", "tipo_paciente", "created_at"]
    list_filter = ["tipo_paciente"]
    search_fields = ["paciente__nombre", "paciente__apellido"]
    readonly_fields = ["ip_hash"]
