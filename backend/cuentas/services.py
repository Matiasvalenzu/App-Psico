import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from notificaciones.services import enqueue_welcome_email, send_branded_email

from .models import CodigoVerificacionRegistro, PerfilPsicologo


EMAIL_CODE_TTL_MINUTES = 10
MAX_EMAIL_CODE_ATTEMPTS = 5


def get_or_create_profile(user):
    profile, _ = PerfilPsicologo.objects.get_or_create(
        user=user,
        defaults={
            "email_notificaciones": user.email,
            "email_notificaciones_verificado_at": timezone.now() if user.email else None,
        },
    )
    return profile


def get_notification_email(user):
    return (get_or_create_profile(user).email_notificaciones_efectivo or "").strip().lower()


def _hash_code(profile_id, code):
    return signing.salted_hmac(
        "cuentas.email-notificaciones",
        f"{profile_id}:{code}",
        secret=settings.SECRET_KEY,
        algorithm="sha256",
    ).hexdigest()


def request_notification_email_change(profile, email):
    email = email.strip().lower()
    if email == profile.email_notificaciones_efectivo.lower():
        return False
    code = f"{secrets.randbelow(1_000_000):06d}"
    profile.email_notificaciones_pendiente = email
    profile.email_verificacion_hash = _hash_code(profile.pk, code)
    profile.email_verificacion_expira_at = timezone.now() + timedelta(
        minutes=EMAIL_CODE_TTL_MINUTES
    )
    profile.email_verificacion_intentos = 0
    profile.save(
        update_fields=[
            "email_notificaciones_pendiente",
            "email_verificacion_hash",
            "email_verificacion_expira_at",
            "email_verificacion_intentos",
            "updated_at",
        ]
    )
    send_branded_email(
        subject="Verifica tu correo de notificaciones en Psiconex",
        recipient=email,
        template_name="verificar_email_profesional",
        context={
            "first_name": profile.user.first_name or profile.user.username,
            "verification_code": code,
            "expiration_minutes": EMAIL_CODE_TTL_MINUTES,
        },
        reply_to=settings.EMAIL_SUPPORT_ADDRESS,
    )
    return True


def verify_notification_email(user, code):
    error = None
    with transaction.atomic():
        profile = PerfilPsicologo.objects.select_for_update().get(user=user)
        if (
            not profile.email_verificacion_hash
            or not profile.email_verificacion_expira_at
            or profile.email_verificacion_expira_at <= timezone.now()
        ):
            error = "El código expiró. Solicita uno nuevo."
        elif profile.email_verificacion_intentos >= MAX_EMAIL_CODE_ATTEMPTS:
            error = "Superaste el máximo de intentos. Solicita otro código."
        else:
            expected = _hash_code(profile.pk, code.strip())
            if not hmac.compare_digest(expected, profile.email_verificacion_hash):
                profile.email_verificacion_intentos += 1
                profile.save(update_fields=["email_verificacion_intentos", "updated_at"])
                error = "El código ingresado no es válido."
            else:
                profile.email_notificaciones = profile.email_notificaciones_pendiente
                profile.email_notificaciones_verificado_at = timezone.now()
                profile.email_notificaciones_pendiente = ""
                profile.email_verificacion_hash = ""
                profile.email_verificacion_expira_at = None
                profile.email_verificacion_intentos = 0
                profile.save()
    if error:
        raise serializers.ValidationError(error)
    return profile


def _hash_registration_code(email: str, code: str) -> str:
    return signing.salted_hmac(
        "cuentas.registro-usuario",
        f"{email}:{code}",
        secret=settings.SECRET_KEY,
        algorithm="sha256",
    ).hexdigest()


def request_user_registration(first_name: str, last_name: str, email: str, password: str):
    email = email.strip().lower()
    first_name = first_name.strip()
    last_name = last_name.strip()

    if not email:
        raise serializers.ValidationError({"email": "El correo electrónico es obligatorio."})

    try:
        validate_email(email)
    except DjangoValidationError:
        raise serializers.ValidationError({"email": "Ingresa un correo electrónico válido."})

    if not password:
        raise serializers.ValidationError({"password": "La contraseña es obligatoria."})

    User = get_user_model()
    if User.objects.filter(email__iexact=email).exists():
        raise serializers.ValidationError(
            {"email": "Ya existe una cuenta con este correo electrónico. Por favor inicia sesión o ingresa con Google."}
        )

    # Validar robustez de la contraseña
    temp_user = User(username=email.split("@")[0], email=email, first_name=first_name, last_name=last_name)
    try:
        validate_password(password, temp_user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"password": " ".join(exc.messages)})

    code = f"{secrets.randbelow(1_000_000):06d}"
    hashed_code = _hash_registration_code(email, code)
    hashed_password = make_password(password)

    CodigoVerificacionRegistro.objects.update_or_create(
        email=email,
        defaults={
            "first_name": first_name,
            "last_name": last_name,
            "password_hash": hashed_password,
            "codigo_hash": hashed_code,
            "expira_at": timezone.now() + timedelta(minutes=EMAIL_CODE_TTL_MINUTES),
            "intentos": 0,
        },
    )

    send_branded_email(
        subject=f"Tu código de verificación de Psiconex: {code}",
        recipient=email,
        template_name="codigo_registro",
        context={
            "first_name": first_name or "Colega",
            "verification_code": code,
            "expiration_minutes": EMAIL_CODE_TTL_MINUTES,
        },
        reply_to=settings.EMAIL_SUPPORT_ADDRESS,
    )
    return True


def confirm_user_registration(email: str, code: str):
    email = email.strip().lower()
    code = code.strip()

    if not email or not code:
        raise serializers.ValidationError("El correo y el código son obligatorios.")

    User = get_user_model()
    error = None
    created_user = None

    with transaction.atomic():
        try:
            record = CodigoVerificacionRegistro.objects.select_for_update().get(email=email)
        except CodigoVerificacionRegistro.DoesNotExist:
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError("Esta cuenta ya está verificada. Inicia sesión directamente.")
            raise serializers.ValidationError("No hay un proceso de registro pendiente para este correo.")

        if not record.codigo_hash or not record.expira_at or record.expira_at <= timezone.now():
            error = "El código ha expirado. Solicita un nuevo código."
        elif record.intentos >= MAX_EMAIL_CODE_ATTEMPTS:
            error = "Has superado el número máximo de intentos. Solicita un nuevo código."
        else:
            expected = _hash_registration_code(email, code)
            if not hmac.compare_digest(expected, record.codigo_hash):
                record.intentos += 1
                record.save(update_fields=["intentos", "updated_at"])
                error = "El código ingresado es incorrecto."
            else:
                if User.objects.filter(email__iexact=email).exists():
                    record.delete()
                    raise serializers.ValidationError("Ya existe una cuenta con este correo electrónico.")

                # Generar username único basado en el email
                base_username = email.split("@")[0]
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                created_user = User(
                    username=username,
                    email=email,
                    first_name=record.first_name,
                    last_name=record.last_name,
                )
                created_user.password = record.password_hash
                created_user.save()

                # Crear perfil si no existe
                get_or_create_profile(created_user)

                # Notificación de bienvenida
                enqueue_welcome_email(created_user)

                # Eliminar registro temporal
                record.delete()

    if error:
        raise serializers.ValidationError(error)

    return created_user


def resend_registration_code(email: str):
    email = email.strip().lower()
    if not email:
        raise serializers.ValidationError({"email": "El correo es obligatorio."})

    User = get_user_model()
    if User.objects.filter(email__iexact=email).exists():
        raise serializers.ValidationError(
            {"email": "Esta cuenta ya está activa. Por favor inicia sesión con tu contraseña o con Google."}
        )

    try:
        record = CodigoVerificacionRegistro.objects.get(email=email)
    except CodigoVerificacionRegistro.DoesNotExist:
        raise serializers.ValidationError({"email": "No hay un registro pendiente para este correo."})

    code = f"{secrets.randbelow(1_000_000):06d}"
    record.codigo_hash = _hash_registration_code(email, code)
    record.expira_at = timezone.now() + timedelta(minutes=EMAIL_CODE_TTL_MINUTES)
    record.intentos = 0
    record.save(update_fields=["codigo_hash", "expira_at", "intentos", "updated_at"])

    send_branded_email(
        subject=f"Tu nuevo código de verificación de Psiconex: {code}",
        recipient=email,
        template_name="codigo_registro",
        context={
            "first_name": record.first_name or "Colega",
            "verification_code": code,
            "expiration_minutes": EMAIL_CODE_TTL_MINUTES,
        },
        reply_to=settings.EMAIL_SUPPORT_ADDRESS,
    )
    return True
