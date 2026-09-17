from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
    ordering_fields = ["apellido", "nombre", "created_at", "updated_at"]
    ordering = ["apellido", "nombre"]

    def get_serializer_class(self):
        if self.action == "list":
            return PacienteListSerializer
        return PacienteSerializer

    def get_queryset(self):
        return super().get_queryset().filter(psicologo=self.request.user)

    def perform_create(self, serializer):
        serializer.save(psicologo=self.request.user)


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
