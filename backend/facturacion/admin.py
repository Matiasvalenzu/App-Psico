from django.contrib import admin

from .models import Cobro
from .serializers import CAMPOS_RECEPTOR


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
