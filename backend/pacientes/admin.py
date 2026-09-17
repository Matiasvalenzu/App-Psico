from django.contrib import admin
from .models import Paciente


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = [
        "nombre", "apellido", "rut", "edad", "sexo", "ocupacion_laboral",
        "estado", "activo", "created_at", "updated_at",
    ]
    list_filter = ["estado", "activo", "sexo"]
    search_fields = ["nombre", "apellido", "rut"]
    ordering = ["apellido", "nombre"]


from .models import ConsentimientoInformado


@admin.register(ConsentimientoInformado)
class ConsentimientoInformadoAdmin(admin.ModelAdmin):
    list_display = [
        "id", "paciente", "psicologo", "estado", "fecha_envio", "fecha_firma", "firma_nombre", "created_at"
    ]
    list_filter = ["estado", "email_enviado"]
    search_fields = ["paciente__nombre", "paciente__apellido", "paciente__rut", "firma_nombre", "firma_rut"]
    readonly_fields = ["token_hash", "enlace_firma", "firma_ip", "firma_user_agent", "created_at", "updated_at"]

