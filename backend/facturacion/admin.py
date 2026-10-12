from django.contrib import admin
from django.utils import timezone

from .models import Cobro, ConfiguracionBHE, DelegacionSII, EmisionBHE
from .serializers import CAMPOS_RECEPTOR
from .services import enmascarar_rut


@admin.register(Cobro)
class CobroAdmin(admin.ModelAdmin):
    # Sin datos del receptor en el listado ni en la búsqueda.
    list_display = ["id", "psicologo", "fecha_pago", "monto_bruto", "estado_pago", "estado_boleta"]
    list_filter = ["estado_pago", "estado_boleta", "bhe_modo"]
    raw_id_fields = ["psicologo", "paciente", "sesion"]
    readonly_fields = CAMPOS_RECEPTOR

    def get_fields(self, request, obj=None):
        campos = super().get_fields(request, obj)
        if request.user.is_superuser:
            return campos
        ocultos = {*CAMPOS_RECEPTOR, "paciente", "glosa", "notas"}
        return [campo for campo in campos if campo not in ocultos]


@admin.register(DelegacionSII)
class DelegacionSIIAdmin(admin.ModelAdmin):
    list_display = ["id", "psicologo", "rut_enmascarado", "estado", "fecha_vencimiento", "verificada", "piloto"]
    list_filter = ["estado", "verificada", "piloto"]
    raw_id_fields = ["psicologo"]
    # El RUT del emisor nunca se muestra completo, ni siquiera a superusuarios.
    exclude = ["rut_emisor"]
    readonly_fields = ["rut_enmascarado", "fecha_vencimiento", "verificada_at", "consentimiento_at", "consentimiento_version"]

    @admin.display(description="RUT emisor")
    def rut_enmascarado(self, obj):
        return enmascarar_rut(obj.rut_emisor)


@admin.register(EmisionBHE)
class EmisionBHEAdmin(admin.ModelAdmin):
    # Solo lectura: el estado lo mueve la tarea o la resolución manual desde la API.
    list_display = ["id", "cobro_id", "tipo", "estado", "paso", "intentos", "folio", "backend", "created_at"]
    list_filter = ["tipo", "estado", "backend"]
    # payload y evidencias contienen datos del receptor: ocultos para todos.
    exclude = ["payload", "evidencias"]

    def get_readonly_fields(self, request, obj=None):
        return [campo.name for campo in self.model._meta.fields if campo.name not in self.exclude]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ConfiguracionBHE)
class ConfiguracionBHEAdmin(admin.ModelAdmin):
    list_display = ["__str__", "pausada_motivo", "pausada_at", "updated_at"]
    fields = ["pausada", "pausada_motivo", "pausada_at"]
    readonly_fields = ["pausada_at"]

    def save_model(self, request, obj, form, change):
        if "pausada" in form.changed_data:
            obj.pausada_at = timezone.now() if obj.pausada else None
        super().save_model(request, obj, form, change)

    def has_add_permission(self, request):
        return not ConfiguracionBHE.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
