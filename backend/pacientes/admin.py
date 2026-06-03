from django.contrib import admin
from .models import Paciente


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = [
        "nombre", "apellido", "rut", "edad", "sexo", "ocupacion_laboral",
        "activo", "created_at", "updated_at",
    ]
    list_filter = ["activo", "sexo"]
    search_fields = ["nombre", "apellido", "rut"]
    ordering = ["apellido", "nombre"]
