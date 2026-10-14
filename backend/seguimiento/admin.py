from django.contrib import admin

from .models import AplicacionEscala, DiagnosticoCIE10, DocumentoClinicoIA, PortalSeguimiento, RegistroAnimo, TareaIntersesion

for m in (AplicacionEscala, DiagnosticoCIE10, DocumentoClinicoIA, TareaIntersesion, RegistroAnimo):
    admin.site.register(m)


@admin.register(PortalSeguimiento)
class PortalAdmin(admin.ModelAdmin):
    exclude = ("token_hash",)
