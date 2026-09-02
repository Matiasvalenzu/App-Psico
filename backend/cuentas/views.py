from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import PerfilPsicologoSerializer
from .services import (
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
