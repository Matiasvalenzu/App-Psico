from django.http import FileResponse
from django.utils import timezone
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .acceso import registrar_acceso
from .exportacion import exportar_cuenta
from .models import RegistroAcceso
from .serializers import PerfilPsicologoSerializer
from .services import (
    eliminar_cuenta,
    get_or_create_profile,
    request_notification_email_change,
    verify_notification_email,
)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile_detail(request):
    profile = get_or_create_profile(request.user)
    if request.method == "GET":
        return Response(PerfilPsicologoSerializer(profile).data)

    serializer = PerfilPsicologoSerializer(profile, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    requested_email = serializer.validated_data.get("email_notificaciones")
    profile = serializer.save()
    code_sent = False
    if requested_email:
        code_sent = request_notification_email_change(profile, requested_email)
    response = PerfilPsicologoSerializer(profile).data
    response["codigo_enviado"] = code_sent
    return Response(response)


@ratelimit(key="user", rate="8/h", method="POST", block=True)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_notification_email_view(request):
    code = str(request.data.get("codigo", "")).strip()
    if len(code) != 6 or not code.isdigit():
        return Response(
            {"codigo": ["Ingresa el código de 6 dígitos."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    profile = verify_notification_email(request.user, code)
    return Response(PerfilPsicologoSerializer(profile).data)


@ratelimit(key="user", rate="5/h", method="POST", block=True)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eliminar_cuenta_view(request):
    user = request.user
    if user.is_superuser:
        return Response(
            {"detail": "Una cuenta de superusuario no se puede eliminar desde aquí."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if user.has_usable_password():
        if not user.check_password(request.data.get("password", "")):
            return Response(
                {"password": ["La contraseña no es correcta."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif str(request.data.get("confirmacion", "")).strip() != "ELIMINAR":
        return Response(
            {"confirmacion": ["Escribe ELIMINAR para confirmar."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    eliminar_cuenta(user)
    return Response({"detail": "Tu cuenta y todos tus datos fueron eliminados."})


@ratelimit(key="user", rate="10/h", method="GET", block=True)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def exportar_cuenta_view(request):
    registrar_acceso(request, RegistroAcceso.Accion.EXPORTAR, objeto="Cuenta completa (ZIP)")
    return FileResponse(
        exportar_cuenta(request.user),
        as_attachment=True,
        filename=f"psiconex-exportacion-{timezone.localdate():%Y-%m-%d}.zip",
        content_type="application/zip",
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def actividad_view(request):
    registros = request.user.registros_acceso.select_related("paciente")[:200]
    return Response(
        [
            {
                "id": r.id,
                "fecha": r.fecha,
                "accion": r.accion,
                "accion_display": r.get_accion_display(),
                "paciente": r.paciente.nombre_completo if r.paciente else None,
                "paciente_id": r.paciente_id,
                "objeto": r.objeto,
                "ip": r.ip,
            }
            for r in registros
        ]
    )
