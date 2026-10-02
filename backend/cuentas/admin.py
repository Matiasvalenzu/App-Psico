from django.contrib import admin

from .models import PerfilPsicologo, RegistroConsumoIA


@admin.register(PerfilPsicologo)
class PerfilPsicologoAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "email_notificaciones",
        "especialidad_clinica",
        "modalidad_atencion",
    )
    search_fields = ("user__username", "user__email", "email_notificaciones")


@admin.register(RegistroConsumoIA)
class RegistroConsumoIAAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "servicio",
        "modelo",
        "tokens_total",
        "costo_estimado_usd",
        "created_at",
    )
    list_filter = ("servicio", "modelo", "created_at")
    search_fields = ("user__username", "user__email")
