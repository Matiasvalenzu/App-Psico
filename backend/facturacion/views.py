import mimetypes
import os

from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from cuentas.services import get_or_create_profile

from . import bhe
from .models import Cobro, DelegacionSII, EmisionBHE
from .permissions import TienePlanPlus
from .serializers import (
    AnularSIISerializer,
    CobroSerializer,
    DelegacionSolicitudSerializer,
    EmisionBHESerializer,
    MarcarEmitidaSerializer,
)


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
        qs = Cobro.objects.select_related("paciente").prefetch_related("emisiones").filter(psicologo=self.request.user)
        for param in ("paciente", "sesion", "estado_boleta"):
            valor = self.request.query_params.get(param)
            if valor:
                qs = qs.filter(**{param: valor})
        return qs

    def perform_create(self, serializer):
        serializer.save(psicologo=self.request.user)

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
        if cobro.estado_boleta != Cobro.EstadoBoleta.EMITIDA:
            return Response({"detail": "Solo se puede anular una boleta emitida."}, status=status.HTTP_400_BAD_REQUEST)
        if cobro.emisiones.filter(tipo=EmisionBHE.Tipo.ANULACION, estado__in=EmisionBHE.ESTADOS_ACTIVOS).exists():
            return Response(
                {"detail": bhe.MENSAJES["anulacion_en_curso"], "code": "anulacion_en_curso"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cobro.estado_boleta = Cobro.EstadoBoleta.ANULADA
        cobro.boleta_anulada_at = timezone.now()
        cobro.save()
        return Response(self.get_serializer(cobro).data)

    def _cobro_actualizado(self, cobro, estado=status.HTTP_200_OK):
        cobro = self.get_queryset().get(pk=cobro.pk)
        return Response(self.get_serializer(cobro).data, status=estado)

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
        cobro = self.get_object()
        datos = AnularSIISerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        if not datos.validated_data["confirmado"]:
            return _confirmacion_requerida()
        try:
            bhe.solicitar_anulacion(cobro, datos.validated_data["causa"], request.user)
        except bhe.EmisionNoPermitida as exc:
            return _no_permitida(exc)
        return self._cobro_actualizado(cobro, status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="cancelar-sii")
    def cancelar_sii(self, request, pk=None):
        cobro = self.get_object()
        try:
            bhe.cancelar_emision(cobro)
        except bhe.EmisionNoPermitida as exc:
            return _no_permitida(exc)
        return self._cobro_actualizado(cobro)

    @action(detail=True, methods=["get"])
    def emisiones(self, request, pk=None):
        cobro = self.get_object()
        return Response(EmisionBHESerializer(cobro.emisiones.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path=r"emisiones/(?P<emision_id>\d+)/pdf")
    def pdf_emision(self, request, pk=None, emision_id=None):
        # Solo el PDF: las capturas del portal quedan para el staff, en el admin.
        emision = get_object_or_404(self.get_object().emisiones, pk=emision_id)
        if not emision.pdf:
            raise Http404
        return descarga_privada(emision.pdf.storage, emision.pdf.name)


class DelegacionView(APIView):
    """Autorización del psicólogo a la cuenta de Psiconex en el SII. Nunca se activa sola."""

    permission_classes = [IsAuthenticated, TienePlanPlus]

    def get(self, request):
        return Response(self._datos(request.user))

    def post(self, request):
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
            "rut_autorizar": settings.BHE_RUT_AUTORIZADO,
            "consentimiento_version": delegacion.consentimiento_version if delegacion else "",
            "consentimiento_version_vigente": bhe.CONSENTIMIENTO_VERSION,
            "motivo_bloqueo": motivo,
            "mensaje_bloqueo": bhe.MENSAJES[motivo] if motivo else "",
        }
