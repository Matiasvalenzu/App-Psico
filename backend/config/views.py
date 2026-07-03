from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _is_admin_user(user):
    return user.is_authenticated and user.username == "Admin"


def _is_superuser(user):
    return user.is_authenticated and user.is_superuser


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response(
        {
            "username": request.user.username,
            "is_admin": _is_admin_user(request.user),
            "is_superuser": request.user.is_superuser,
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
