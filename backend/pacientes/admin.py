from django.contrib import admin
from .models import Paciente


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = ["nombre", "apellido", "activo", "created_at", "updated_at"]
    list_filter = ["activo"]
    search_fields = ["nombre", "apellido"]
    ordering = ["apellido", "nombre"]
