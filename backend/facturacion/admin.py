from django import forms
from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.core.validators import RegexValidator
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from .bhe import EmisionNoPermitida, reanudar_cola, resolver_manual
from .models import Cobro, ConfiguracionBHE, DelegacionSII, EmisionBHE
from .serializers import CAMPOS_RECEPTOR
from .services import enmascarar_rut
from .views import descarga_privada


@admin.register(Cobro)
class CobroAdmin(admin.ModelAdmin):
    # Sin datos del receptor en el listado ni en la búsqueda.
    list_display = ["id", "psicologo", "fecha_pago", "monto_bruto", "estado_pago", "estado_boleta"]
    list_filter = ["estado_pago", "estado_boleta", "bhe_modo"]
    raw_id_fields = ["psicologo", "paciente", "sesion"]
    readonly_fields = [*CAMPOS_RECEPTOR, "anulacion_solicitada_at", "anulacion_solicitada_por"]

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
    readonly_fields = ["rut_enmascarado", "verificada_at", "consentimiento_at", "consentimiento_version"]
    fieldsets = [
        (
            None,
            {
                "description": (
                    "Antes de marcar «verificada»: entra al portal del SII con la clave de la cuenta de Psiconex, "
                    "ve a Boletas de honorarios electrónicas > Emitir > Por usuario autorizado y confirma que el RUT "
                    "y el nombre del psicólogo aparecen en la lista de autorizadores. Al marcarla verificada pasa a Activa. "
                    "Anota la fecha de vencimiento solo si el SII la muestra; si no, déjala vacía (sin avisos ni "
                    "vencimiento automático)."
                ),
                "fields": [
                    "psicologo", "rut_enmascarado", "estado", "fecha_otorgada", "fecha_vencimiento",
                    "verificada", "verificada_at", "piloto", "ultimo_error", "consentimiento_at",
                    "consentimiento_version",
                ],
            },
        )
    ]

    @admin.display(description="RUT emisor")
    def rut_enmascarado(self, obj):
        return enmascarar_rut(obj.rut_emisor)

    def save_model(self, request, obj, form, change):
        if "verificada" in form.changed_data:
            obj.verificada_at = timezone.now() if obj.verificada else None
            # Solo el operador activa una delegación, después de verla en el SII.
            if obj.verificada and obj.estado == DelegacionSII.Estado.PENDIENTE_VERIFICACION:
                obj.estado = DelegacionSII.Estado.ACTIVA
        super().save_model(request, obj, form, change)


class ResolverEmisionForm(forms.Form):
    hecha = forms.TypedChoiceField(
        label="¿Aparece en el SII?",
        choices=[("si", "Sí, quedó hecha en el SII"), ("no", "No, no está en el SII")],
        coerce=lambda valor: valor == "si",
        widget=forms.RadioSelect,
    )
    folio = forms.CharField(
        required=False, validators=[RegexValidator(r"^\d{1,12}$", "El folio debe ser numérico.")],
        help_text="Solo para una emisión que sí está en el SII.",
    )
    fecha = forms.DateField(required=False, help_text="Fecha de la boleta en el SII (aaaa-mm-dd). Por omisión, la solicitada.")


@admin.register(EmisionBHE)
class EmisionBHEAdmin(admin.ModelAdmin):
    # Solo lectura: el estado lo mueve la tarea o el formulario «Resolver» (solo superusuarios).
    list_display = ["id", "cobro_id", "tipo", "estado", "paso", "intentos", "folio", "backend", "created_at"]
    list_filter = ["tipo", "estado", "backend"]
    # El payload lleva datos del receptor: oculto para todos. El PDF y las capturas se ven por «Archivos».
    exclude = ["payload", "evidencias", "pdf"]

    def get_readonly_fields(self, request, obj=None):
        campos = [campo.name for campo in self.model._meta.fields if campo.name not in self.exclude]
        if not request.user.is_superuser:
            return ["enlace_resolver", *campos]
        return ["enlace_resolver", "archivos", *campos]

    @admin.display(description="Archivos")
    def archivos(self, obj):
        enlaces = []
        if obj.pdf:
            enlaces.append((reverse("admin:facturacion_emisionbhe_pdf", args=[obj.pk]), "PDF de la boleta"))
        for indice, _ruta in enumerate(obj.evidencias):
            url = reverse("admin:facturacion_emisionbhe_evidencia", args=[obj.pk, indice])
            enlaces.append((url, f"Captura {indice + 1}"))
        if not enlaces:
            return "-"
        return format_html_join(" · ", '<a href="{}">{}</a>', enlaces)

    @admin.display(description="Resolución manual")
    def enlace_resolver(self, obj):
        if obj.estado != EmisionBHE.Estado.DESCONOCIDO:
            return "-"
        return format_html('<a class="button" href="{}">Resolver</a>', reverse("admin:facturacion_emisionbhe_resolver", args=[obj.pk]))

    def get_urls(self):
        propias = [
            path(
                "<int:emision_id>/resolver/",
                self.admin_site.admin_view(self.resolver_view),
                name="facturacion_emisionbhe_resolver",
            ),
            path(
                "<int:emision_id>/pdf/",
                self.admin_site.admin_view(self.archivo_view),
                name="facturacion_emisionbhe_pdf",
            ),
            path(
                "<int:emision_id>/evidencias/<int:indice>/",
                self.admin_site.admin_view(self.archivo_view),
                name="facturacion_emisionbhe_evidencia",
            ),
        ]
        return propias + super().get_urls()

    def archivo_view(self, request, emision_id, indice=None):
        # El PDF y las capturas traen el RUT y los datos del paciente: solo superusuarios.
        if not request.user.is_superuser:
            raise PermissionDenied
        emision = get_object_or_404(EmisionBHE, pk=emision_id)
        if indice is None:
            ruta = emision.pdf.name
        elif indice < len(emision.evidencias):
            ruta = emision.evidencias[indice]
        else:
            ruta = ""
        if not ruta:
            raise Http404
        return descarga_privada(emision.pdf.storage, ruta)

    def resolver_view(self, request, emision_id):
        if not request.user.is_superuser:
            raise PermissionDenied
        emision = get_object_or_404(EmisionBHE, pk=emision_id)
        form = ResolverEmisionForm(request.POST or None)
        if request.method == "POST" and form.is_valid():
            try:
                resolver_manual(emision.pk, request.user, **form.cleaned_data)
            except EmisionNoPermitida as exc:
                form.add_error(None, exc.detalle)
            else:
                self.message_user(request, f"Emisión #{emision.pk} resuelta.")
                return redirect("admin:facturacion_emisionbhe_change", emision.pk)
        contexto = {
            **self.admin_site.each_context(request),
            "title": f"Resolver emisión #{emision.pk}",
            "opts": self.model._meta,
            "emision": emision,
            "form": form,
        }
        return TemplateResponse(request, "admin/facturacion/emisionbhe/resolver.html", contexto)

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
            if not obj.pausada:
                transaction.on_commit(reanudar_cola)
        super().save_model(request, obj, form, change)

    def has_add_permission(self, request):
        return not ConfiguracionBHE.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
