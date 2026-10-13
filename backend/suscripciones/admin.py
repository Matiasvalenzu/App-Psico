from django.conf import settings
from django.contrib import admin

from .models import PagoPlusPendiente


@admin.register(PagoPlusPendiente)
class PagoPlusPendienteAdmin(admin.ModelAdmin):
    list_display = ("mp_preapproval_id", "estado_mp", "creado_en", "vinculado_a", "vinculado_en")
    list_filter = ("estado_mp",)
    readonly_fields = ("mp_preapproval_id", "estado_mp", "enlace_para_vincular", "vinculado_a", "vinculado_en", "creado_en")
    exclude = ("actualizado_en",)

    @admin.display(description="Enlace para vincular (el usuario lo abre con su sesión iniciada)")
    def enlace_para_vincular(self, obj):
        return f"{settings.PUBLIC_APP_URL.rstrip('/')}/suscripcionok?preapproval_id={obj.mp_preapproval_id}"

    def has_add_permission(self, request):
        return False
