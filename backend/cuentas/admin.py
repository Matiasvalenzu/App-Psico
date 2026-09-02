from django.contrib import admin

from .models import PerfilPsicologo


@admin.register(PerfilPsicologo)
class PerfilPsicologoAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "email_notificaciones",
        "especialidad_clinica",
        "modalidad_atencion",
    )
    search_fields = ("user__username", "user__email", "email_notificaciones")
