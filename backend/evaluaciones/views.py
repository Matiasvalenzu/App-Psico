from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .catalog import ELLIS_SLUG, get_test
from .models import EvaluacionAsignada
from .serializers import (
    CrearEvaluacionAsignadaSerializer,
    EvaluacionAsignadaSerializer,
    PublicSubmitSerializer,
    catalog_payload,
    public_test_payload,
)
from .services import (
    build_public_test_url,
    complete_assignment,
    find_assignment_by_token,
    fixed_email_message,
    generate_token,
    hash_token,
    send_assignment_email,
    validate_public_assignment,
)


class CatalogoEvaluacionesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(catalog_payload())


class CatalogoEvaluacionDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        payload = catalog_payload(slug)
        if not payload:
            return Response({"error": "Test no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class EvaluacionAsignadaListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EvaluacionAsignadaSerializer

    def get_queryset(self):
        qs = EvaluacionAsignada.objects.filter(psicologo=self.request.user).select_related(
            "paciente", "psicologo", "sesion"
        )
        paciente_id = self.request.query_params.get("paciente")
        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        return qs

    def create(self, request, *args, **kwargs):
        input_serializer = CrearEvaluacionAsignadaSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        input_serializer.is_valid(raise_exception=True)
        paciente = input_serializer.validated_data["paciente"]
        test_slug = input_serializer.validated_data.get("test_slug") or ELLIS_SLUG
        token = generate_token()
        public_url = build_public_test_url(token)
        expires_at = timezone.now() + timedelta(
            days=getattr(settings, "TEST_LINK_EXPIRATION_DAYS", 7)
        )

        asignacion = EvaluacionAsignada.objects.create(
            paciente=paciente,
            psicologo=request.user,
            test_slug=test_slug,
            token_hash=hash_token(token),
            enlace_generado=public_url,
            email_destino=paciente.email_contacto,
            mensaje_email=fixed_email_message(request.user, paciente, public_url),
            fecha_expiracion=expires_at,
        )
        email_sent, email_error = send_assignment_email(asignacion)
        asignacion.email_enviado = email_sent
        asignacion.email_error = email_error
        if email_sent:
            asignacion.estado = EvaluacionAsignada.Estado.ENVIADO
            asignacion.fecha_envio = timezone.now()
        elif getattr(settings, "EMAIL_HOST", ""):
            asignacion.estado = EvaluacionAsignada.Estado.ERROR_ENVIO
        asignacion.save(
            update_fields=[
                "email_enviado",
                "email_error",
                "estado",
                "fecha_envio",
                "updated_at",
            ]
        )

        data = EvaluacionAsignadaSerializer(asignacion).data
        data["public_url"] = public_url
        data["email_configurado"] = bool(getattr(settings, "EMAIL_HOST", ""))
        return Response(data, status=status.HTTP_201_CREATED)


class EvaluacionAsignadaDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EvaluacionAsignadaSerializer

    def get_queryset(self):
        return EvaluacionAsignada.objects.filter(psicologo=self.request.user).select_related(
            "paciente", "psicologo", "sesion"
        )

    def perform_destroy(self, instance):
        sesion = instance.sesion
        instance.delete()
        if sesion:
            sesion.delete()


class EvaluacionPublicaView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        asignacion = find_assignment_by_token(token)
        if not asignacion:
            return Response({"error": "Enlace no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        state, message = validate_public_assignment(asignacion)
        if state == "EXPIRADO":
            return Response({"estado": state, "message": message}, status=status.HTTP_410_GONE)
        if state == "COMPLETADO":
            return Response({"estado": state, "message": message})
        if not get_test(asignacion.test_slug):
            return Response({"error": "Test no disponible."}, status=status.HTTP_404_NOT_FOUND)
        return Response(public_test_payload(asignacion))


class EvaluacionPublicaResponderView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        asignacion = find_assignment_by_token(token)
        if not asignacion:
            return Response({"error": "Enlace no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        state, message = validate_public_assignment(asignacion)
        if state == "EXPIRADO":
            return Response({"estado": state, "message": message}, status=status.HTTP_410_GONE)
        if state == "COMPLETADO":
            return Response({"estado": state, "message": message}, status=status.HTTP_409_CONFLICT)

        serializer = PublicSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            complete_assignment(asignacion, serializer.validated_data["respuestas"])
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "estado": "COMPLETADO",
                "message": "Gracias. Tus respuestas fueron guardadas y serán revisadas por tu psicólogo/a.",
            }
        )
