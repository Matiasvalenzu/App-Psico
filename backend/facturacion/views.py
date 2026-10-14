import csv
import mimetypes
import os
from datetime import date

from django.conf import settings
from django.db.models import Count, Prefetch, Q, Sum
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from cuentas.acceso import registrar_acceso
from cuentas.models import RegistroAcceso
from cuentas.services import get_or_create_profile
from pacientes.models import Paciente
from sesiones.models import Sesion

from . import bhe
from .envio import EnvioNoDisponible, enlace_whatsapp, enviar_boleta_correo
from .models import CambioEstadoPago, Cobro, DelegacionSII, EnvioBoleta
from .pagos import cambiar_estado_pago
from .permissions import TienePlanPlus
from .serializers import (
    CobroSerializer,
    DelegacionSolicitudSerializer,
    EmisionBHESerializer,
    MarcarEmitidaSerializer,
    MarcarPagadoSerializer,
    receptor_desde_ficha,
)
from .services import hoy_chile


def _mes_pedido(request):
    """Mes de ?mes=AAAA-MM; por defecto, el mes actual en Chile."""
    valor = request.query_params.get("mes")
    if not valor:
        hoy = hoy_chile()
        return hoy.year, hoy.month
    try:
        anio, mes = (int(parte) for parte in valor.split("-"))
        date(anio, mes, 1)
    except ValueError:
        raise ValidationError({"mes": "Usa el formato AAAA-MM."})
    return anio, mes


def _celda_csv(valor):
    # Evita que Excel interprete como fórmula un nombre o glosa que empiece con = + - @.
    texto = "" if valor is None else str(valor)
    return f"'{texto}" if texto[:1] in ("=", "+", "-", "@") else texto


def _totales(qs):
    datos = qs.aggregate(total=Sum("monto_bruto"), cantidad=Count("id"))
    return {"total": datos["total"] or 0, "cantidad": datos["cantidad"]}


class SolicitudesBHEThrottle(UserRateThrottle):
    # Freno ante un frontend que repite la solicitud en bucle: no debe llenar la cola.
    scope = "bhe"
    rate = "10/min"


def _no_permitida(exc):
    estado = status.HTTP_403_FORBIDDEN if exc.codigo in bhe.CODIGOS_BLOQUEO else status.HTTP_400_BAD_REQUEST
    return Response({"detail": exc.detalle, "code": exc.codigo}, status=estado)


def descarga_privada(storage, ruta):
    """Entrega un archivo del almacenamiento BHE como adjunto, sin caché."""
    try:
        archivo = storage.open(ruta, "rb")
    except FileNotFoundError:
        raise Http404
    tipo = mimetypes.guess_type(ruta)[0] or "application/octet-stream"
    respuesta = FileResponse(archivo, as_attachment=True, filename=os.path.basename(ruta), content_type=tipo)
    respuesta["Cache-Control"] = "no-store"
    return respuesta


def _confirmacion_requerida():
    return Response(
        {"detail": bhe.MENSAJES["confirmacion_requerida"], "code": "confirmacion_requerida"},
        status=status.HTTP_400_BAD_REQUEST,
    )


class CobroViewSet(viewsets.ModelViewSet):
    serializer_class = CobroSerializer
    permission_classes = [IsAuthenticated, TienePlanPlus]

    def get_queryset(self):
        qs = (
            Cobro.objects.select_related("paciente")
            .prefetch_related(
                "emisiones",
                Prefetch("cambios_pago", CambioEstadoPago.objects.select_related("usuario")),
                Prefetch("envios", EnvioBoleta.objects.select_related("enviado_por")),
                "sesiones",
            )
            .filter(psicologo=self.request.user)
        )
        for param in ("paciente", "estado_boleta", "estado_pago"):
            valor = self.request.query_params.get(param)
            if valor:
                qs = qs.filter(**{param: valor})
        sesion = self.request.query_params.get("sesion")
        if sesion:
            qs = qs.filter(Q(sesion=sesion) | Q(sesiones=sesion)).distinct()
        if self.request.query_params.get("mes"):
            anio, mes = _mes_pedido(self.request)
            qs = qs.filter(fecha_pago__year=anio, fecha_pago__month=mes)
        return qs

    def perform_create(self, serializer):
        pagado = serializer.validated_data.get("estado_pago", Cobro.EstadoPago.PAGADO) == Cobro.EstadoPago.PAGADO
        serializer.save(
            psicologo=self.request.user, pagado_el=serializer.validated_data["fecha_pago"] if pagado else None
        )

    def perform_update(self, serializer):
        # El estado de pago pasa por cambiar_estado_pago para que quede registro de quién lo cambió.
        nuevo = serializer.validated_data.pop("estado_pago", None)
        cobro = serializer.save()
        if nuevo and nuevo != cobro.estado_pago:
            pagado_el = hoy_chile() if nuevo == Cobro.EstadoPago.PAGADO else None
            cambiar_estado_pago(cobro, nuevo, self.request.user, pagado_el)
            serializer.instance = self.get_queryset().get(pk=cobro.pk)

    def perform_destroy(self, instance):
        if instance.estado_boleta == Cobro.EstadoBoleta.EMITIDA:
            raise ValidationError("No se puede borrar un cobro con boleta emitida. Anúlala primero.")
        if instance.estado_boleta == Cobro.EstadoBoleta.EN_EMISION:
            raise ValidationError("La boleta se está emitiendo en el SII. Espera a que termine.")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="marcar-emitida")
    def marcar_emitida(self, request, pk=None):
        cobro = self.get_object()
        if cobro.estado_boleta == Cobro.EstadoBoleta.ANULADA:
            return Response({"detail": "La boleta está anulada."}, status=status.HTTP_400_BAD_REQUEST)
        if cobro.estado_boleta == Cobro.EstadoBoleta.EN_EMISION:
            return Response(
                {"detail": "La boleta se está emitiendo en el SII. Espera a que termine.", "code": "en_emision"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cobro.bhe_modo != Cobro.ModoBoleta.SIN_DATOS_RECEPTOR and not (
            cobro.receptor_documento and cobro.receptor_nombre
        ):
            return Response(
                {"detail": "Falta el RUT del tutor/receptor.", "code": "receptor_incompleto"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        datos = MarcarEmitidaSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        cobro.estado_boleta = Cobro.EstadoBoleta.EMITIDA
        cobro.boleta_folio = datos.validated_data["folio"]
        cobro.boleta_fecha_emision = datos.validated_data.get("fecha_emision") or timezone.localdate()
        cobro.boleta_anulada_at = None
        cobro.save()
        return Response(self.get_serializer(cobro).data)

    @action(detail=True, methods=["post"], url_path="marcar-anulada")
    def marcar_anulada(self, request, pk=None):
        cobro = self.get_object()
        try:
            bhe.registrar_anulacion(cobro, request.user)
        except bhe.EmisionNoPermitida:
            return Response({"detail": "Solo se puede anular una boleta emitida."}, status=status.HTTP_400_BAD_REQUEST)
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["post"], url_path="marcar-pagado")
    def marcar_pagado(self, request, pk=None):
        cobro = self.get_object()
        if cobro.estado_pago == Cobro.EstadoPago.PAGADO:
            return Response({"detail": "El cobro ya está pagado."}, status=status.HTTP_400_BAD_REQUEST)
        datos = MarcarPagadoSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        fecha = datos.validated_data.get("fecha") or hoy_chile()
        cambiar_estado_pago(cobro, Cobro.EstadoPago.PAGADO, request.user, fecha)
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["post"], url_path="marcar-pendiente")
    def marcar_pendiente(self, request, pk=None):
        cobro = self.get_object()
        if cobro.estado_pago == Cobro.EstadoPago.PENDIENTE:
            return Response({"detail": "El cobro ya está pendiente."}, status=status.HTTP_400_BAD_REQUEST)
        cambiar_estado_pago(cobro, Cobro.EstadoPago.PENDIENTE, request.user)
        return self._cobro_actualizado(cobro)

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        anio, mes = _mes_pedido(request)
        cobros = Cobro.objects.filter(psicologo=request.user)
        del_mes = cobros.filter(fecha_pago__year=anio, fecha_pago__month=mes)
        pendientes = cobros.filter(estado_pago=Cobro.EstadoPago.PENDIENTE)
        deudores = list(
            pendientes.filter(paciente__isnull=False)
            .values("paciente")
            .annotate(total=Sum("monto_bruto"), cantidad=Count("id"))
            .order_by("-total", "paciente")[:5]
        )
        nombres = {
            p.id: p.nombre_completo for p in Paciente.objects.filter(id__in=[d["paciente"] for d in deudores])
        }
        retencion = del_mes.exclude(
            estado_boleta__in=[Cobro.EstadoBoleta.ANULADA, Cobro.EstadoBoleta.NO_APLICA]
        ).aggregate(total=Sum("monto_retencion"))["total"]
        vinculadas = Cobro.sesiones.through.objects.values("sesion_id")
        con_fk = Cobro.objects.filter(sesion__isnull=False).values("sesion_id")
        sin_cobro = (
            Sesion.objects.filter(
                paciente__psicologo=request.user,
                estado=Sesion.Estado.COMPLETADO,
                origen__in=[Sesion.Origen.AUDIO, Sesion.Origen.VIRTUAL],
                fecha_hora_inicio__year=anio,
                fecha_hora_inicio__month=mes,
            )
            .exclude(pk__in=vinculadas)
            .exclude(pk__in=con_fk)
            .count()
        )
        return Response(
            {
                "mes": f"{anio}-{mes:02d}",
                "pagado_mes": _totales(
                    cobros.filter(estado_pago=Cobro.EstadoPago.PAGADO, pagado_el__year=anio, pagado_el__month=mes)
                ),
                "pendiente_mes": _totales(del_mes.filter(estado_pago=Cobro.EstadoPago.PENDIENTE)),
                "pendiente_total": _totales(pendientes),
                "retencion_mes": retencion or 0,
                "top_deudores": [{**d, "nombre": nombres.get(d["paciente"], "")} for d in deudores],
                "sesiones_sin_cobro": sin_cobro,
            }
        )

    @action(detail=False, methods=["get"])
    def exportar(self, request):
        """CSV de los cobros del mes para el contador."""
        anio, mes = _mes_pedido(request)
        cobros = (
            Cobro.objects.select_related("paciente")
            .filter(psicologo=request.user, fecha_pago__year=anio, fecha_pago__month=mes)
            .order_by("fecha_pago", "id")
        )
        respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
        respuesta["Content-Disposition"] = f'attachment; filename="cobros-{anio}-{mes:02d}.csv"'
        respuesta.write("\ufeff")  # BOM: Excel abre el archivo como UTF-8.
        escritor = csv.writer(respuesta, delimiter=";")
        escritor.writerow([
            "Fecha atención", "Paciente", "Receptor", "Documento receptor", "Monto bruto", "Retención",
            "Líquido", "Medio de pago", "Estado de pago", "Fecha de pago", "Estado boleta", "Folio",
            "Fecha emisión",
        ])  # fmt: skip
        for cobro in cobros:
            escritor.writerow([_celda_csv(valor) for valor in (
                cobro.fecha_pago, cobro.paciente.nombre_completo if cobro.paciente else "", cobro.receptor_nombre,
                cobro.receptor_documento, cobro.monto_bruto, cobro.monto_retencion, cobro.monto_liquido,
                cobro.get_medio_pago_display(), cobro.get_estado_pago_display(), cobro.pagado_el,
                cobro.get_estado_boleta_display(), cobro.boleta_folio, cobro.boleta_fecha_emision,
            )])  # fmt: skip
        registrar_acceso(request, RegistroAcceso.Accion.EXPORTAR, objeto=f"Cobros {anio}-{mes:02d}")
        return respuesta

    def _cobro_actualizado(self, cobro, estado=status.HTTP_200_OK):
        cobro = self.get_queryset().get(pk=cobro.pk)
        return Response(self.get_serializer(cobro).data, status=estado)

    @action(detail=True, methods=["post"], url_path="actualizar-receptor")
    def actualizar_receptor(self, request, pk=None):
        cobro = self.get_object()
        if cobro.estado_boleta not in (Cobro.EstadoBoleta.PENDIENTE, Cobro.EstadoBoleta.ANULADA):
            return Response(
                {"detail": "Solo se actualiza el receptor de una boleta sin emitir."}, status=status.HTTP_400_BAD_REQUEST
            )
        if not cobro.paciente:
            return Response({"detail": "El cobro ya no tiene paciente."}, status=status.HTTP_400_BAD_REQUEST)
        cambios = receptor_desde_ficha(cobro)
        for campo, valor in cambios.items():
            setattr(cobro, campo, valor)
        cobro.save(update_fields=[*cambios, "updated_at"])
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["post"], url_path="emitir-sii", throttle_classes=[SolicitudesBHEThrottle])
    def emitir_sii(self, request, pk=None):
        cobro = self.get_object()
        if request.data.get("confirmado") is not True:
            return _confirmacion_requerida()
        try:
            bhe.solicitar_emision(cobro, request.user)
        except bhe.EmisionNoPermitida as exc:
            return _no_permitida(exc)
        return self._cobro_actualizado(cobro, status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="anular-sii", throttle_classes=[SolicitudesBHEThrottle])
    def anular_sii(self, request, pk=None):
        # Solo deja pedida la anulación: el psicólogo la hace en el SII y vuelve a marcar «Ya la anulé».
        cobro = self.get_object()
        try:
            bhe.solicitar_anulacion(cobro, request.user)
        except bhe.EmisionNoPermitida as exc:
            return _no_permitida(exc)
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["post"], url_path="cancelar-sii")
    def cancelar_sii(self, request, pk=None):
        cobro = self.get_object()
        try:
            bhe.cancelar_emision(cobro)
        except bhe.EmisionNoPermitida as exc:
            return _no_permitida(exc)
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["get"], url_path="enlace-whatsapp")
    def enlace_whatsapp_action(self, request, pk=None):
        cobro = self.get_object()
        try:
            url = enlace_whatsapp(cobro, request)
        except EnvioNoDisponible as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"url": url})

    @action(detail=True, methods=["post"], url_path="enviar-correo")
    def enviar_correo(self, request, pk=None):
        if request.data.get("confirmado") is not True:
            return Response(
                {"detail": "Confirma el destinatario antes de enviar el correo.", "code": "confirmacion_requerida"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cobro = self.get_object()
        try:
            enviar_boleta_correo(cobro, request.user)
        except EnvioNoDisponible as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["get"])
    def emisiones(self, request, pk=None):
        cobro = self.get_object()
        return Response(EmisionBHESerializer(cobro.emisiones.all(), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path=r"emisiones/(?P<emision_id>\d+)/pdf")
    def pdf_emision(self, request, pk=None, emision_id=None):
        # Solo el PDF: las capturas del portal quedan para el staff, en el admin.
        cobro = self.get_object()
        emision = get_object_or_404(cobro.emisiones, pk=emision_id)
        if request.method == "POST":
            # El que el psicólogo bajó de su SII, cuando el robot no alcanzó a bajarlo.
            archivo = request.FILES.get("archivo")
            try:
                if not archivo or archivo.size > settings.DOCUMENT_UPLOAD_MAX_BYTES:
                    raise bhe.EmisionNoPermitida("pdf_invalido")
                bhe.subir_pdf(emision, archivo.read())
            except bhe.EmisionNoPermitida as exc:
                return _no_permitida(exc)
            return self._cobro_actualizado(cobro)
        if not emision.pdf:
            raise Http404
        return descarga_privada(emision.pdf.storage, emision.pdf.name)


class DelegacionView(APIView):
    """Autorización del psicólogo a la cuenta de Psiconex en el SII. Nunca se activa sola."""

    permission_classes = [IsAuthenticated, TienePlanPlus]

    def get(self, request):
        return Response(self._datos(request.user))

    def post(self, request):
        if not settings.BHE_AUTO_DISPONIBLE:
            return Response(
                {"detail": bhe.MENSAJES["bhe_no_disponible"], "code": "bhe_no_disponible"},
                status=status.HTTP_403_FORBIDDEN,
            )
        delegacion = DelegacionSII.objects.filter(psicologo=request.user).first()
        # Desde POR_VENCER sí se puede: es la renovación (vuelve a verificación).
        if delegacion and delegacion.estado == DelegacionSII.Estado.ACTIVA:
            return Response(
                {"detail": "Ya tienes una autorización vigente.", "code": "delegacion_vigente"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        perfil = get_or_create_profile(request.user)
        datos = DelegacionSolicitudSerializer(data=request.data, context={"perfil": perfil})
        datos.is_valid(raise_exception=True)
        if not perfil.rut_profesional:
            # El RUT queda en el perfil y desde ahí ya no se puede cambiar.
            perfil.rut_profesional = datos.validated_data["rut"]
            perfil.save(update_fields=["rut_profesional"])
        DelegacionSII.objects.update_or_create(
            psicologo=request.user,
            defaults={
                # Siempre el RUT del perfil: nunca se emite a nombre de otra persona.
                "rut_emisor": perfil.rut_profesional,
                "estado": DelegacionSII.Estado.PENDIENTE_VERIFICACION,
                "fecha_otorgada": datos.validated_data.get("fecha_otorgada") or timezone.localdate(),
                "fecha_vencimiento": None,
                "verificada": False,
                "verificada_at": None,
                "ultimo_error": "",
                "consentimiento_at": timezone.now(),
                "consentimiento_version": bhe.CONSENTIMIENTO_VERSION,
                "numero_transaccion": datos.validated_data.get("numero_transaccion", ""),
            },
        )
        return Response(self._datos(request.user), status=status.HTTP_201_CREATED)

    def _datos(self, usuario):
        delegacion = DelegacionSII.objects.filter(psicologo=usuario).first()
        perfil = get_or_create_profile(usuario)
        motivo = bhe.motivo_bloqueo(usuario)
        return {
            "estado": delegacion.estado if delegacion else DelegacionSII.Estado.NO_INICIADA,
            "rut_emisor": delegacion.rut_emisor if delegacion else perfil.rut_profesional,
            "fecha_otorgada": delegacion.fecha_otorgada if delegacion else None,
            "fecha_vencimiento": delegacion.fecha_vencimiento if delegacion else None,
            "verificada": bool(delegacion and delegacion.verificada),
            "piloto": bool(delegacion and delegacion.piloto),
            "numero_transaccion": delegacion.numero_transaccion if delegacion else "",
            "rut_autorizar": settings.BHE_RUT_AUTORIZADO,
            "consentimiento_version": delegacion.consentimiento_version if delegacion else "",
            "consentimiento_version_vigente": bhe.CONSENTIMIENTO_VERSION,
            "motivo_bloqueo": motivo,
            "mensaje_bloqueo": bhe.MENSAJES[motivo] if motivo else "",
        }
