import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from notificaciones.services import send_branded_email

from .models import PerfilPsicologo


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
