from django.contrib import admin

from .models import AgendaCita


@admin.register(AgendaCita)
class AgendaCitaAdmin(admin.ModelAdmin):
    list_display = ["paciente", "psicologo", "inicio", "fin", "estado", "recurrencia"]
    list_filter = ["estado", "recurrencia", "inicio"]
    search_fields = ["paciente__nombre", "paciente__apellido", "psicologo__username"]
    ordering = ["-inicio"]
