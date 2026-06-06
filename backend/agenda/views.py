import re
import uuid
from datetime import timedelta
from urllib.parse import quote

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AgendaCita
from .serializers import AgendaCitaSerializer


class AgendaCitaViewSet(viewsets.ModelViewSet):
    serializer_class = AgendaCitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AgendaCita.objects.filter(psicologo=self.request.user).select_related(
            "paciente", "psicologo"
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if request.query_params.get("incluir_anuladas") != "true":
            qs = qs.exclude(estado=AgendaCita.Estado.ANULADA)

        desde = self._parse_datetime_param(
            request.query_params.get("desde") or request.query_params.get("start")
        )
        hasta = self._parse_datetime_param(
            request.query_params.get("hasta") or request.query_params.get("end")
        )
        if desde:
            qs = qs.filter(fin__gt=desde)
        if hasta:
            qs = qs.filter(inicio__lt=hasta)

        return Response(self.get_serializer(qs, many=True).data)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        citas_data = self._build_occurrences(data)

        conflictos = [
            cita["inicio"]
            for cita in citas_data
            if self._has_overlap(request.user, cita["inicio"], cita["fin"])
        ]
        if conflictos:
            return Response(
                {
                    "error": "El horario seleccionado se cruza con otra cita activa.",
                    "conflictos": [inicio.isoformat() for inicio in conflictos[:10]],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        citas = [AgendaCita.objects.create(**cita) for cita in citas_data]
        output = self.get_serializer(citas, many=True)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        inicio = serializer.validated_data.get("inicio", instance.inicio)
        fin = inicio + timedelta(hours=1)
        estado_nuevo = serializer.validated_data.get("estado", instance.estado)
        if estado_nuevo != AgendaCita.Estado.ANULADA and self._has_overlap(
            request.user,
            inicio,
            fin,
            exclude_id=instance.id,
        ):
            return Response(
                {"error": "El horario seleccionado se cruza con otra cita activa."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cita = serializer.save(fin=fin)
        return Response(self.get_serializer(cita).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.estado = AgendaCita.Estado.ANULADA
        instance.motivo_anulacion = request.data.get("motivo_anulacion", "") if request.data else ""
        instance.save(update_fields=["estado", "motivo_anulacion", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        cita = self.get_object()
        cita.estado = AgendaCita.Estado.ANULADA
        cita.motivo_anulacion = request.data.get("motivo_anulacion", "")
        cita.save(update_fields=["estado", "motivo_anulacion", "updated_at"])
        return Response(self.get_serializer(cita).data)

    @action(detail=True, methods=["post"])
    def marcar_confirmada(self, request, pk=None):
        cita = self.get_object()
        cita.estado = AgendaCita.Estado.CONFIRMADA
        cita.confirmada_at = timezone.now()
        cita.save(update_fields=["estado", "confirmada_at", "updated_at"])
        return Response(self.get_serializer(cita).data)

    @action(detail=True, methods=["post"])
    def solicitar_confirmacion(self, request, pk=None):
        cita = self.get_object()
        cita.estado = AgendaCita.Estado.CONFIRMACION_SOLICITADA
        cita.confirmacion_solicitada_at = timezone.now()
        cita.save(update_fields=["estado", "confirmacion_solicitada_at", "updated_at"])
        mensaje = self._confirmation_message(cita)
        telefono = re.sub(r"\D", "", cita.paciente.telefono_whatsapp or "")
        whatsapp_url = f"https://wa.me/{telefono}?text={quote(mensaje)}" if telefono else ""
        data = self.get_serializer(cita).data
        data["whatsapp_url"] = whatsapp_url
        data["mensaje_whatsapp"] = mensaje
        return Response(data)

    def _parse_datetime_param(self, value):
        if not value:
            return None
        parsed = parse_datetime(value)
        if parsed and timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    def _has_overlap(self, psicologo, inicio, fin, exclude_id=None):
        qs = AgendaCita.objects.filter(
            psicologo=psicologo,
            inicio__lt=fin,
            fin__gt=inicio,
        ).exclude(estado=AgendaCita.Estado.ANULADA)
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.exists()

    def _build_occurrences(self, data):
        recurrencia = data.get("recurrencia", AgendaCita.Recurrencia.NINGUNA)
        inicio = data["inicio"]
        intervalo = 7 if recurrencia == AgendaCita.Recurrencia.SEMANAL else 14
        grupo = uuid.uuid4() if recurrencia != AgendaCita.Recurrencia.NINGUNA else None
        citas = []
        actual = inicio
        limite = data.get("recurrente_hasta") or inicio.date()

        while actual.date() <= limite:
            if len(citas) >= 104:
                break
            citas.append(
                {
                    "psicologo": self.request.user,
                    "paciente": data["paciente"],
                    "inicio": actual,
                    "fin": actual + timedelta(hours=1),
                    "estado": data.get("estado", AgendaCita.Estado.PROGRAMADA),
                    "notas": data.get("notas", ""),
                    "recurrencia": recurrencia,
                    "recurrente_hasta": data.get("recurrente_hasta"),
                    "grupo_recurrencia": grupo,
                }
            )
            if recurrencia == AgendaCita.Recurrencia.NINGUNA:
                break
            actual = actual + timedelta(days=intervalo)

        return citas

    def _confirmation_message(self, cita):
        inicio_local = timezone.localtime(cita.inicio)
        fecha = inicio_local.strftime("%d/%m/%Y")
        hora = inicio_local.strftime("%H:%M")
        psicologo = self.request.user.get_full_name() or self.request.user.username
        return (
            f"Hola {cita.paciente.nombre}, te escribo para confirmar tu sesión "
            f"agendada para el {fecha} a las {hora} hrs con {psicologo}. "
            "Por favor responde este mensaje para confirmar tu asistencia."
        )
