from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Cobro
from .permissions import TienePlanPlus
from .serializers import CobroSerializer, MarcarEmitidaSerializer


class CobroViewSet(viewsets.ModelViewSet):
    serializer_class = CobroSerializer
    permission_classes = [TienePlanPlus]

    def get_queryset(self):
        qs = Cobro.objects.select_related("paciente").filter(psicologo=self.request.user)
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
        instance.delete()

    @action(detail=True, methods=["post"], url_path="marcar-emitida")
    def marcar_emitida(self, request, pk=None):
        cobro = self.get_object()
        if cobro.estado_boleta == Cobro.EstadoBoleta.ANULADA:
            return Response({"detail": "La boleta está anulada."}, status=status.HTTP_400_BAD_REQUEST)
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
        cobro.estado_boleta = Cobro.EstadoBoleta.ANULADA
        cobro.boleta_anulada_at = timezone.now()
        cobro.save()
        return Response(self.get_serializer(cobro).data)
