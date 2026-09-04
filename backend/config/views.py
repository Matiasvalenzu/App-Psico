from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from notificaciones.services import enqueue_welcome_email
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response


def _is_admin_user(user):
    return user.is_authenticated and user.username == "Admin"


def _is_superuser(user):
    return user.is_authenticated and user.is_superuser


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    suscripcion_activa = True
    suscripcion_estado = "trial"
    fin_prueba = None
    dias_restantes_prueba = None

    if hasattr(request.user, "suscripcion"):
        suscripcion = request.user.suscripcion
        suscripcion_activa = suscripcion.is_active_or_trial
        suscripcion_estado = suscripcion.estado
        fin_prueba = suscripcion.fin_prueba
        if fin_prueba and suscripcion.estado == "trial":
            delta = fin_prueba - timezone.now()
            dias_restantes_prueba = max(0, delta.days + (1 if delta.seconds > 0 else 0))

    return Response(
        {
            "username": request.user.username,
            "email": request.user.email,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "is_admin": _is_admin_user(request.user),
            "is_superuser": request.user.is_superuser,
            "suscripcion_activa": suscripcion_activa,
            "suscripcion_estado": suscripcion_estado,
            "fin_prueba": fin_prueba,
            "dias_restantes_prueba": dias_restantes_prueba,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_user(request):
    if not _is_admin_user(request.user):
        return Response(
            {"detail": "No tienes permiso para crear usuarios."},
            status=status.HTTP_403_FORBIDDEN,
        )

    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))
    first_name = str(request.data.get("first_name", "")).strip()
    last_name = str(request.data.get("last_name", "")).strip()
    email = str(request.data.get("email", "")).strip()

    if not username or not password:
        return Response(
            {"detail": "Usuario y contraseña son obligatorios."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return Response(
            {"detail": "Ya existe un usuario con ese nombre."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User(
        username=username,
        first_name=first_name,
        last_name=last_name,
        email=email,
    )

    try:
        validate_password(password, user)
    except ValidationError as exc:
        return Response(
            {"detail": " ".join(exc.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(password)
    user.save()
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_users(request):
    if not _is_superuser(request.user):
        return Response(
            {"detail": "No tienes permiso para listar usuarios."},
            status=status.HTTP_403_FORBIDDEN,
        )

    User = get_user_model()
    users = User.objects.order_by("username")
    return Response(
        [
            {
                "id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "date_joined": user.date_joined,
                "last_login": user.last_login,
            }
            for user in users
        ]
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_user_password(request, user_id):
    if not _is_superuser(request.user):
        return Response(
            {"detail": "No tienes permiso para cambiar claves."},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_password = str(request.data.get("password", ""))
    if not new_password:
        return Response(
            {"detail": "La nueva contraseña es obligatoria."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"detail": "Usuario no encontrado."},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        validate_password(new_password, user)
    except ValidationError as exc:
        return Response(
            {"detail": " ".join(exc.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()
    return Response({"detail": "Contraseña actualizada exitosamente."})

@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    token = request.data.get("credential")
    if not token:
        return Response({"detail": "Falta el token de Google."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        from django.conf import settings

        # Verificar token con Google
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )

        email = (idinfo.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "El token de Google no incluye un correo electrónico."}, status=status.HTTP_400_BAD_REQUEST)
        if not idinfo.get("email_verified"):
            return Response(
                {"detail": "Google no confirmó que el correo electrónico esté verificado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")

        User = get_user_model()
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()

            if not user:
                username = email.split("@")[0]
                original_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{original_username}{counter}"
                    counter += 1

                user = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                )
                user.set_unusable_password()
                user.save()
                enqueue_welcome_email(user)

        # Generar JWT tokens
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh)
        })

    except ValueError as exc:
        return Response({"detail": f"Token inválido: {str(exc)}"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response({"detail": f"Error de autenticación con Google: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    first_name = str(request.data.get("first_name", "")).strip()
    last_name = str(request.data.get("last_name", "")).strip()
    email = str(request.data.get("email", "")).strip()
    password = str(request.data.get("password", ""))

    try:
        from cuentas.services import request_user_registration
        request_user_registration(first_name, last_name, email, password)
        return Response(
            {"detail": "Código de verificación enviado exitosamente a tu correo."},
            status=status.HTTP_200_OK,
        )
    except serializers.ValidationError as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            msg = next(iter(detail.values()))
            if isinstance(msg, list):
                msg = msg[0]
            return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)
        msg = detail[0] if isinstance(detail, list) else detail
        return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response(
            {"detail": f"Error al procesar el registro: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_registration(request):
    email = str(request.data.get("email", "")).strip()
    code = str(request.data.get("code", "")).strip()

    try:
        from cuentas.services import confirm_user_registration
        user = confirm_user_registration(email, code)

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "detail": "Cuenta verificada con éxito. ¡Bienvenido a Psiconex!",
            },
            status=status.HTTP_201_CREATED,
        )
    except serializers.ValidationError as exc:
        detail = exc.detail
        msg = detail[0] if isinstance(detail, list) else detail
        return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response(
            {"detail": f"Error al verificar código: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_registration_code_view(request):
    email = str(request.data.get("email", "")).strip()

    try:
        from cuentas.services import resend_registration_code
        resend_registration_code(email)
        return Response({"detail": "Nuevo código enviado a tu correo."}, status=status.HTTP_200_OK)
    except serializers.ValidationError as exc:
        detail = exc.detail
        msg = detail[0] if isinstance(detail, list) else detail
        return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response(
            {"detail": f"Error al reenviar código: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
