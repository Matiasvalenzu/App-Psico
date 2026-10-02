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
import os
import logging
from django.db.models import Count, Sum
from cuentas.models import RegistroConsumoIA
from pacientes.models import Paciente
from sesiones.models import Sesion
from suscripciones.models import Suscripcion

logger = logging.getLogger(__name__)


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

    tutorial_visto = False
    if hasattr(request.user, "perfil_psicologo"):
        tutorial_visto = request.user.perfil_psicologo.tutorial_visto

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
            "tutorial_visto": tutorial_visto,
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
    users = User.objects.order_by("-date_joined")

    # 1. Total pacientes por psicólogo
    pacientes_map = dict(
        Paciente.objects.values("psicologo_id").annotate(c=Count("id")).values_list("psicologo_id", "c")
    )

    # 2. Total duración de audio y sesiones por psicólogo
    sesiones_qs = Sesion.objects.values("paciente__psicologo_id").annotate(
        c=Count("id"),
        segundos=Sum("duracion_segundos")
    )
    sesiones_map = {
        item["paciente__psicologo_id"]: (item["c"], item["segundos"] or 0)
        for item in sesiones_qs
        if item["paciente__psicologo_id"]
    }

    # 3. Total tokens y costo IA por usuario
    tokens_qs = RegistroConsumoIA.objects.values("user_id").annotate(
        t=Sum("tokens_total"),
        costo=Sum("costo_estimado_usd")
    )
    tokens_map = {
        item["user_id"]: (item["t"] or 0, float(item["costo"] or 0))
        for item in tokens_qs
    }

    # 4. Suscripciones por usuario
    suscripciones_map = {s.user_id: s for s in Suscripcion.objects.all()}

    now = timezone.now()
    result = []
    for user in users:
        p_count = pacientes_map.get(user.id, 0)
        s_count, s_segundos = sesiones_map.get(user.id, (0, 0))
        audio_minutos = round(s_segundos / 60, 1)
        audio_horas = round(s_segundos / 3600, 2)

        t_total, costo_usd = tokens_map.get(user.id, (0, 0.0))

        susc = suscripciones_map.get(user.id)
        dias_restantes = None
        if susc and susc.fin_prueba and susc.estado == "trial":
            delta = susc.fin_prueba - now
            dias_restantes = max(0, delta.days + (1 if delta.seconds > 0 else 0))

        susc_info = {
            "estado": susc.estado if susc else "trial",
            "is_active_or_trial": susc.is_active_or_trial if susc else True,
            "fin_prueba": susc.fin_prueba if susc else None,
            "dias_restantes_prueba": dias_restantes,
            "card_last_four": susc.card_last_four if susc else "",
            "card_brand": susc.card_brand if susc else "",
            "proximo_cobro": susc.proximo_cobro if susc else None,
            "has_mp_preapproval": bool(susc and susc.mp_preapproval_id),
        }

        result.append({
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
            "pacientes_count": p_count,
            "sesiones_count": s_count,
            "audio_segundos_total": s_segundos,
            "audio_minutos_total": audio_minutos,
            "audio_horas_total": audio_horas,
            "tokens_ia_total": t_total,
            "costo_ia_total_usd": round(costo_usd, 4),
            "suscripcion": susc_info,
        })

    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_system_stats(request):
    if not _is_superuser(request.user):
        return Response(
            {"detail": "No tienes permiso para ver estadísticas del sistema."},
            status=status.HTTP_403_FORBIDDEN,
        )

    User = get_user_model()
    now = timezone.now()
    thirty_days_ago = now - timezone.timedelta(days=30)

    total_usuarios = User.objects.count()
    usuarios_activos_mes = User.objects.filter(last_login__gte=thirty_days_ago).count()

    total_pacientes = Paciente.objects.count()
    total_sesiones = Sesion.objects.count()
    total_audio_segundos = Sesion.objects.aggregate(s=Sum("duracion_segundos"))["s"] or 0
    total_audio_horas = round(total_audio_segundos / 3600, 1)

    ia_agg = RegistroConsumoIA.objects.aggregate(
        t=Sum("tokens_total"),
        c=Sum("costo_estimado_usd"),
    )
    total_tokens_ia = ia_agg["t"] or 0
    total_costo_ia_usd = float(ia_agg["c"] or 0)

    susc_counts = Suscripcion.objects.values("estado").annotate(c=Count("id"))
    susc_dist = {item["estado"]: item["c"] for item in susc_counts}
    suscripciones_activas = susc_dist.get("activa", 0)
    suscripciones_trial = susc_dist.get("trial", 0)
    suscripciones_canceladas = (
        susc_dist.get("cancelada", 0)
        + susc_dist.get("expirada", 0)
        + susc_dist.get("past_due", 0)
    )

    return Response({
        "total_usuarios": total_usuarios,
        "usuarios_activos_mes": usuarios_activos_mes,
        "total_pacientes": total_pacientes,
        "total_sesiones": total_sesiones,
        "total_audio_horas": total_audio_horas,
        "total_tokens_ia": total_tokens_ia,
        "total_costo_ia_usd": round(total_costo_ia_usd, 4),
        "suscripciones_activas": suscripciones_activas,
        "suscripciones_trial": suscripciones_trial,
        "suscripciones_canceladas": suscripciones_canceladas,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def manage_user_subscription(request, user_id):
    if not _is_superuser(request.user):
        return Response(
            {"detail": "No tienes permiso para gestionar suscripciones."},
            status=status.HTTP_403_FORBIDDEN,
        )

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    suscripcion, _ = Suscripcion.objects.get_or_create(
        user=user,
        defaults={"estado": "trial", "fin_prueba": timezone.now() + timezone.timedelta(days=14)},
    )

    dias_adicionales = request.data.get("dias_adicionales_prueba")
    nuevo_estado = request.data.get("estado")

    if dias_adicionales is not None:
        try:
            dias = int(dias_adicionales)
            base_date = suscripcion.fin_prueba if (suscripcion.fin_prueba and suscripcion.fin_prueba > timezone.now()) else timezone.now()
            suscripcion.fin_prueba = base_date + timezone.timedelta(days=dias)
            suscripcion.estado = "trial"
        except (ValueError, TypeError):
            return Response({"detail": "Días adicionales debe ser un número entero válido."}, status=status.HTTP_400_BAD_REQUEST)

    if nuevo_estado in ["trial", "activa", "past_due", "cancelada", "expirada"]:
        suscripcion.estado = nuevo_estado
        if nuevo_estado == "cancelada":
            suscripcion.cancelada_en = timezone.now()

    suscripcion.save()

    delta = (suscripcion.fin_prueba - timezone.now()) if suscripcion.fin_prueba else None
    dias_restantes = max(0, delta.days + (1 if delta.seconds > 0 else 0)) if (delta and suscripcion.estado == "trial") else None

    return Response({
        "detail": "Suscripción actualizada exitosamente.",
        "suscripcion": {
            "estado": suscripcion.estado,
            "is_active_or_trial": suscripcion.is_active_or_trial,
            "fin_prueba": suscripcion.fin_prueba,
            "dias_restantes_prueba": dias_restantes,
            "card_last_four": suscripcion.card_last_four,
            "card_brand": suscripcion.card_brand,
            "proximo_cobro": suscripcion.proximo_cobro,
            "has_mp_preapproval": bool(suscripcion.mp_preapproval_id),
        },
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    if not _is_superuser(request.user):
        return Response(
            {"detail": "No tienes permiso para eliminar usuarios."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.user.id == user_id:
        return Response(
            {"detail": "Por seguridad, no puedes eliminar tu propia cuenta de superusuario."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    username = user.username

    # 1. Cancelar preapproval en Mercado Pago si tiene suscripción con débito recurrente
    if hasattr(user, "suscripcion") and user.suscripcion.mp_preapproval_id:
        try:
            from suscripciones.views import _get_mp_sdk
            sdk = _get_mp_sdk()
            sdk.preapproval().update(user.suscripcion.mp_preapproval_id, {"status": "cancelled"})
        except Exception as exc:
            logger.warning(
                "No se pudo cancelar preapproval en MP al borrar usuario %s: %s", username, exc
            )

    # 2. Limpieza de archivos físicos en disco (audios de sesiones)
    sesiones_con_audio = Sesion.objects.filter(paciente__psicologo=user).exclude(audio_path="")
    for ses in sesiones_con_audio:
        if ses.audio_path and os.path.exists(ses.audio_path):
            try:
                os.remove(ses.audio_path)
            except OSError:
                pass

    # 3. Borrado atómico de la cuenta y relaciones en cascada
    with transaction.atomic():
        user.delete()

    return Response({
        "detail": f"El usuario {username} y todos sus datos fueron eliminados permanentemente."
    }, status=status.HTTP_200_OK)

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
