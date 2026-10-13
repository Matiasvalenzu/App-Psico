from datetime import date

from django.db import IntegrityError
from django.db.models import Count, IntegerField, OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from agenda.models import AgendaCita
from cuentas.acceso import registrar_acceso
from cuentas.models import RegistroAcceso
from cuentas.exportacion import carpeta_paciente, exportar_paciente
from facturacion.models import Cobro
from sesiones.audio import borrar_carpeta_paciente
from sesiones.models import Sesion

from .documentos import TIPO_RUT
from .models import ConsentimientoInformado, Paciente
from .serializers import (
    ConsentimientoInformadoSerializer,
    CrearConsentimientoSerializer,
    FirmarConsentimientoSerializer,
    PacienteListSerializer,
    PacienteSerializer,
    PublicConsentimientoSerializer,
)
from .services import (
    build_public_consentimiento_url,
    consentimiento_vigente,
    find_consentimiento_by_token,
    generate_token,
    hash_token,
    send_consentimiento_email,
)


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


class PacienteViewSet(viewsets.ModelViewSet):
    queryset = Paciente.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["activo"]
    search_fields = ["nombre", "apellido", "motivo_consulta"]
    ordering_fields = [
        "apellido", "nombre", "created_at", "updated_at", "ultima_sesion", "proxima_cita", "deuda_pendiente",
    ]
    ordering = ["apellido", "nombre"]

    def get_serializer_class(self):
        if self.action == "list":
            return PacienteListSerializer
        return PacienteSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(psicologo=self.request.user)
        if self.action == "list":
            cobros_pendientes = (
                Cobro.objects.filter(paciente=OuterRef("pk"), estado_pago=Cobro.EstadoPago.PENDIENTE)
                .order_by()
                .values("paciente")
            )
            # Datos de la tabla de trabajo: una subconsulta por columna, sin N+1
            qs = qs.annotate(
                ultima_sesion=Subquery(
                    Sesion.objects.filter(paciente=OuterRef("pk"))
                    .order_by("-fecha_hora_inicio")
                    .values("fecha_hora_inicio")[:1]
                ),
                proxima_cita=Subquery(
                    AgendaCita.objects.filter(paciente=OuterRef("pk"), inicio__gte=timezone.now())
                    .exclude(estado=AgendaCita.Estado.ANULADA)
                    .order_by("inicio")
                    .values("inicio")[:1]
                ),
                consentimiento_estado=Subquery(
                    ConsentimientoInformado.objects.filter(paciente=OuterRef("pk"))
                    .order_by("-created_at")
                    .values("estado")[:1]
                ),
                deuda_pendiente=Coalesce(
                    Subquery(
                        cobros_pendientes.annotate(total=Sum("monto_bruto")).values("total"),
                        output_field=IntegerField(),
                    ),
                    0,
                ),
                cobros_pendientes=Coalesce(
                    Subquery(cobros_pendientes.annotate(n=Count("id")).values("n"), output_field=IntegerField()),
                    0,
                ),
            )
        return qs

    def retrieve(self, request, *args, **kwargs):
        paciente = self.get_object()
        registrar_acceso(request, RegistroAcceso.Accion.VER_FICHA, paciente, "Ficha")
        return Response(self.get_serializer(paciente).data)

    @action(detail=True, methods=["get"])
    def exportar(self, request, pk=None):
        paciente = self.get_object()
        registrar_acceso(request, RegistroAcceso.Accion.EXPORTAR, paciente, "Ficha completa (ZIP)")
        return FileResponse(
            exportar_paciente(paciente),
            as_attachment=True,
            filename=f"psiconex-{carpeta_paciente(paciente)}.zip",
            content_type="application/zip",
        )

    @action(detail=True, methods=["post", "delete"], url_path="consentimiento/papel")
    def consentimiento_papel(self, request, pk=None):
        """Declara (o retira) un consentimiento firmado fuera de Psiconex."""
        paciente = self.get_object()
        if request.method == "DELETE":
            paciente.consentimiento_papel_fecha = None
        else:
            fecha = request.data.get("fecha")
            try:
                paciente.consentimiento_papel_fecha = (
                    date.fromisoformat(fecha) if fecha else timezone.localdate()
                )
            except (TypeError, ValueError):
                return Response({"fecha": ["Fecha inválida (AAAA-MM-DD)."]}, status=400)
            if paciente.consentimiento_papel_fecha > timezone.localdate():
                return Response({"fecha": ["La fecha no puede ser futura."]}, status=400)
        paciente.save(update_fields=["consentimiento_papel_fecha", "updated_at"])
        return Response(
            {
                "consentimiento_papel_fecha": paciente.consentimiento_papel_fecha,
                "consentimiento_vigente": consentimiento_vigente(paciente),
            }
        )

    def perform_create(self, serializer):
        try:
            serializer.save(psicologo=self.request.user)
        except IntegrityError:
            tipo = serializer.validated_data.get("tipo_documento", TIPO_RUT)
            field_name = "rut" if tipo == TIPO_RUT else "numero_documento"
            raise serializers.ValidationError(
                {field_name: "Ya tienes un paciente registrado con este documento."}
            )

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            tipo = serializer.validated_data.get("tipo_documento", TIPO_RUT)
            field_name = "rut" if tipo == TIPO_RUT else "numero_documento"
            raise serializers.ValidationError(
                {field_name: "Ya tienes un paciente registrado con este documento."}
            )

    def perform_destroy(self, instance):
        paciente_id = instance.pk
        registrar_acceso(
            self.request, RegistroAcceso.Accion.ELIMINAR, objeto=f"Paciente #{paciente_id}"
        )
        instance.delete()
        borrar_carpeta_paciente(paciente_id)


class PacienteConsentimientoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        paciente = get_object_or_404(Paciente, id=paciente_id, psicologo=request.user)
        consentimiento = paciente.consentimientos.first()
        if not consentimiento:
            return Response({"consentimiento": None}, status=status.HTTP_200_OK)
        return Response(
            {"consentimiento": ConsentimientoInformadoSerializer(consentimiento).data},
            status=status.HTTP_200_OK,
        )

    def post(self, request, paciente_id):
        paciente = get_object_or_404(Paciente, id=paciente_id, psicologo=request.user)
        serializer = CrearConsentimientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        contenido = serializer.validated_data["contenido"]
        titulo = serializer.validated_data.get(
            "titulo", "Consentimiento Informado para Atención Psicológica"
        )
        email_destino = (
            serializer.validated_data.get("email_destino")
            or paciente.email_contacto
            or ""
        ).strip()
        enviar_email = serializer.validated_data.get("enviar_email", False)

        raw_token = generate_token()
        token_digest = hash_token(raw_token)
        enlace_firma = build_public_consentimiento_url(raw_token)

        consentimiento = ConsentimientoInformado.objects.create(
            paciente=paciente,
            psicologo=request.user,
            titulo=titulo,
            contenido=contenido,
            token_hash=token_digest,
            enlace_firma=enlace_firma,
            email_destino=email_destino,
            estado=ConsentimientoInformado.Estado.BORRADOR,
        )

        email_enviado = False
        email_error = ""
        if enviar_email:
            email_enviado, email_error = send_consentimiento_email(consentimiento)
            consentimiento.email_enviado = email_enviado
            consentimiento.email_error = email_error
            if email_enviado:
                consentimiento.estado = ConsentimientoInformado.Estado.ENVIADO
                consentimiento.fecha_envio = timezone.now()
            consentimiento.save(
                update_fields=[
                    "email_enviado",
                    "email_error",
                    "estado",
                    "fecha_envio",
                    "updated_at",
                ]
            )

        data = ConsentimientoInformadoSerializer(consentimiento).data
        data["public_url"] = enlace_firma
        data["raw_token"] = raw_token
        return Response(data, status=status.HTTP_201_CREATED)


class ReenviarConsentimientoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        consentimiento = get_object_or_404(
            ConsentimientoInformado, id=pk, psicologo=request.user
        )
        email_nuevo = request.data.get("email_destino")
        if email_nuevo:
            consentimiento.email_destino = str(email_nuevo).strip()

        email_enviado, email_error = send_consentimiento_email(consentimiento)
        consentimiento.email_enviado = email_enviado
        consentimiento.email_error = email_error
        if email_enviado and consentimiento.estado != ConsentimientoInformado.Estado.FIRMADO:
            consentimiento.estado = ConsentimientoInformado.Estado.ENVIADO
            consentimiento.fecha_envio = timezone.now()

        consentimiento.save(
            update_fields=[
                "email_destino",
                "email_enviado",
                "email_error",
                "estado",
                "fecha_envio",
                "updated_at",
            ]
        )

        if not email_enviado:
            return Response(
                {
                    "error": email_error or "No se pudo entregar el correo electrónico.",
                    "consentimiento": ConsentimientoInformadoSerializer(consentimiento).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Correo enviado con éxito.",
                "consentimiento": ConsentimientoInformadoSerializer(consentimiento).data,
            },
            status=status.HTTP_200_OK,
        )


class PublicConsentimientoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        consentimiento = find_consentimiento_by_token(token)
        if not consentimiento:
            return Response(
                {"error": "Enlace de consentimiento no válido o no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PublicConsentimientoSerializer(consentimiento).data)


class PublicFirmarConsentimientoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        consentimiento = find_consentimiento_by_token(token)
        if not consentimiento:
            return Response(
                {"error": "Enlace de consentimiento no válido o no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if consentimiento.estado == ConsentimientoInformado.Estado.FIRMADO:
            return Response(
                {
                    "message": "Este consentimiento ya fue firmado digitalmente.",
                    "fecha_firma": consentimiento.fecha_firma,
                    "firma_nombre": consentimiento.firma_nombre,
                    "estado": consentimiento.estado,
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = FirmarConsentimientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        firma_nombre = serializer.validated_data["firma_nombre"].strip()
        firma_rut = serializer.validated_data["firma_rut"].strip()
        firma_imagen = serializer.validated_data.get("firma_imagen", "").strip()

        now = timezone.now()
        client_ip = get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        consentimiento.estado = ConsentimientoInformado.Estado.FIRMADO
        consentimiento.fecha_firma = now
        consentimiento.firma_nombre = firma_nombre
        consentimiento.firma_rut = firma_rut
        consentimiento.firma_imagen = firma_imagen
        consentimiento.firma_ip = client_ip[:60]
        consentimiento.firma_user_agent = user_agent[:500]
        consentimiento.save(
            update_fields=[
                "estado",
                "fecha_firma",
                "firma_nombre",
                "firma_rut",
                "firma_imagen",
                "firma_ip",
                "firma_user_agent",
                "updated_at",
            ]
        )

        # Crear respaldo en InformeIA
        try:
            from chat.models import InformeIA

            fecha_str = now.strftime("%d/%m/%Y a las %H:%M hrs")
            InformeIA.objects.create(
                paciente=consentimiento.paciente,
                psicologo=consentimiento.psicologo,
                tipo=InformeIA.Tipo.OTRO,
                titulo=f"Consentimiento Informado Firmado - {consentimiento.paciente.nombre_completo}",
                contenido=(
                    f"{consentimiento.contenido}\n\n"
                    f"────────────────────────────────────────\n"
                    f"REGISTRO DE FIRMA ELECTRÓNICA:\n"
                    f"Firmante: {firma_nombre}\n"
                    f"RUT / Documento: {firma_rut}\n"
                    f"Fecha y Hora: {fecha_str}\n"
                    f"Dirección IP: {client_ip}\n"
                    f"Estado: Aceptado y firmado voluntariamente.\n"
                ),
            )
        except Exception:
            pass

        return Response(
            {
                "estado": "FIRMADO",
                "message": "Consentimiento informado firmado y registrado con éxito.",
                "fecha_firma": now,
                "firma_nombre": firma_nombre,
                "firma_rut": firma_rut,
            },
            status=status.HTTP_200_OK,
        )
