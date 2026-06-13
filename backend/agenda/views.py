import re
import uuid
from datetime import timedelta
from urllib.parse import quote, urlencode

from django.conf import settings
from django.db import transaction
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from pacientes.models import Paciente

from .google_calendar import (
    GoogleCalendarError,
    build_authorization_url,
    complete_oauth_callback,
    disconnect_google_calendar,
    get_connection_status,
    get_redirect_uri,
    sync_app_to_google,
    sync_cita_to_google,
    sync_google_to_app,
)
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
        for cita in citas:
            sync_cita_to_google(cita)
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
        sync_cita_to_google(cita)
        return Response(self.get_serializer(cita).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.estado = AgendaCita.Estado.ANULADA
        instance.motivo_anulacion = request.data.get("motivo_anulacion", "") if request.data else ""
        instance.save(update_fields=["estado", "motivo_anulacion", "updated_at"])
        sync_cita_to_google(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        cita = self.get_object()
        cita.estado = AgendaCita.Estado.ANULADA
        cita.motivo_anulacion = request.data.get("motivo_anulacion", "")
        cita.save(update_fields=["estado", "motivo_anulacion", "updated_at"])
        sync_cita_to_google(cita)
        return Response(self.get_serializer(cita).data)

    @action(detail=True, methods=["post"])
    def marcar_confirmada(self, request, pk=None):
        cita = self.get_object()
        cita.estado = AgendaCita.Estado.CONFIRMADA
        cita.confirmada_at = timezone.now()
        cita.save(update_fields=["estado", "confirmada_at", "updated_at"])
        sync_cita_to_google(cita)
        return Response(self.get_serializer(cita).data)

    @action(detail=True, methods=["post"])
    def solicitar_confirmacion(self, request, pk=None):
        cita = self.get_object()
        cita.estado = AgendaCita.Estado.CONFIRMACION_SOLICITADA
        cita.confirmacion_solicitada_at = timezone.now()
        cita.save(update_fields=["estado", "confirmacion_solicitada_at", "updated_at"])
        mensaje = self._confirmation_message(cita)
        telefono = re.sub(r"\D", "", self._contact_whatsapp(cita) or "")
        whatsapp_url = f"https://wa.me/{telefono}?text={quote(mensaje)}" if telefono else ""
        data = self.get_serializer(cita).data
        data["whatsapp_url"] = whatsapp_url
        data["mensaje_whatsapp"] = mensaje
        return Response(data)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def crear_paciente(self, request, pk=None):
        cita = self.get_object()
        if cita.paciente_id:
            return Response(
                {"error": "Esta cita ya está vinculada a una ficha de paciente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre = cita.prospecto_nombre.strip()
        apellido = cita.prospecto_apellido.strip()
        if not nombre or not apellido:
            return Response(
                {"error": "La cita no tiene nombre y apellido suficientes para crear una ficha."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        paciente = Paciente.objects.create(
            psicologo=request.user,
            nombre=nombre,
            apellido=apellido,
            email_contacto=cita.prospecto_email,
            telefono_whatsapp=cita.prospecto_telefono_whatsapp,
            motivo_consulta=cita.prospecto_motivo_consulta,
            notas_privadas=cita.notas,
        )
        cita.paciente = paciente
        cita.save(update_fields=["paciente", "updated_at"])
        sync_cita_to_google(cita)

        return Response(
            {
                "cita": self.get_serializer(cita).data,
                "paciente": {
                    "id": paciente.id,
                    "nombre": paciente.nombre,
                    "apellido": paciente.apellido,
                    "nombre_completo": paciente.nombre_completo,
                },
            },
            status=status.HTTP_201_CREATED,
        )

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
                    "paciente": data.get("paciente"),
                    "prospecto_nombre": data.get("prospecto_nombre", ""),
                    "prospecto_apellido": data.get("prospecto_apellido", ""),
                    "prospecto_email": data.get("prospecto_email", ""),
                    "prospecto_telefono_whatsapp": data.get("prospecto_telefono_whatsapp", ""),
                    "prospecto_motivo_consulta": data.get("prospecto_motivo_consulta", ""),
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

    def _contact_first_name(self, cita):
        if cita.paciente_id and cita.paciente:
            return cita.paciente.nombre
        return cita.prospecto_nombre or ""

    def _contact_whatsapp(self, cita):
        if cita.paciente_id and cita.paciente:
            return cita.paciente.telefono_whatsapp
        return cita.prospecto_telefono_whatsapp

    def _confirmation_message(self, cita):
        inicio_local = timezone.localtime(cita.inicio)
        fecha = inicio_local.strftime("%d/%m/%Y")
        hora = inicio_local.strftime("%H:%M")
        psicologo = self.request.user.get_full_name() or self.request.user.username
        nombre = self._contact_first_name(cita)
        saludo = f"Hola {nombre}," if nombre else "Hola,"
        return (
            f"{saludo} te escribo para confirmar tu sesión "
            f"agendada para el {fecha} a las {hora} hrs con {psicologo}. "
            "Por favor responde este mensaje para confirmar tu asistencia."
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_calendar_status(request):
    return Response(get_connection_status(request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_calendar_connect(request):
    try:
        auth_url = build_authorization_url(request.user, get_redirect_uri(request))
    except GoogleCalendarError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"auth_url": auth_url})


@api_view(["GET"])
@permission_classes([AllowAny])
def google_calendar_callback(request):
    frontend_url = settings.PUBLIC_APP_URL.rstrip("/") + "/dashboard/agenda"
    if request.query_params.get("error"):
        params = urlencode({"google_calendar": "error"})
        return redirect(f"{frontend_url}?{params}")

    code = request.query_params.get("code")
    oauth_state = request.query_params.get("state")
    if not code or not oauth_state:
        params = urlencode({"google_calendar": "error"})
        return redirect(f"{frontend_url}?{params}")

    try:
        complete_oauth_callback(code, oauth_state)
        params = urlencode({"google_calendar": "connected"})
    except GoogleCalendarError:
        params = urlencode({"google_calendar": "error"})
    return redirect(f"{frontend_url}?{params}")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def google_calendar_sync(request):
    try:
        inbound = sync_google_to_app(request.user)
        outbound = sync_app_to_google(request.user)
    except GoogleCalendarError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"google_to_app": inbound, "app_to_google": outbound})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def google_calendar_disconnect(request):
    disconnect_google_calendar(request.user)
    return Response({"connected": False})
