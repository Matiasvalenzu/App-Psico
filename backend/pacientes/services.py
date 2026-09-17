import hashlib
import secrets
from django.conf import settings
from django.utils import timezone
from cuentas.services import get_notification_email
from notificaciones.services import send_branded_email
from .models import ConsentimientoInformado


def generate_token():
    return secrets.token_urlsafe(32)


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_public_consentimiento_url(token):
    base_url = getattr(settings, "PUBLIC_APP_URL", "http://localhost:3000").strip()
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return f"{base_url.rstrip('/')}/consentimiento/{token}"


def send_consentimiento_email(consentimiento):
    if not getattr(settings, "EMAIL_HOST", "") or not getattr(settings, "DEFAULT_FROM_EMAIL", ""):
        return False, "SMTP no configurado; se generó el enlace para entrega manual."

    recipient = (consentimiento.email_destino or consentimiento.paciente.email_contacto or "").strip().lower()
    if not recipient:
        return False, "El paciente no tiene un correo electrónico configurado."

    subject = f"Consentimiento Informado para Atención Psicológica - {consentimiento.paciente.nombre}"
    psychologist_name = (
        consentimiento.psicologo.get_full_name()
        or consentimiento.psicologo.username
        or "tu psicólogo/a"
    )
    public_url = consentimiento.enlace_firma
    try:
        send_branded_email(
            subject=subject,
            recipient=recipient,
            template_name="consentimiento_paciente",
            context={
                "patient_name": consentimiento.paciente.nombre,
                "psychologist_name": psychologist_name,
                "public_url": public_url,
            },
            reply_to=get_notification_email(consentimiento.psicologo)
            or settings.EMAIL_SUPPORT_ADDRESS,
        )
        return True, ""
    except Exception as exc:
        return False, f"No fue posible entregar el correo: {str(exc)}"


def find_consentimiento_by_token(token):
    token_digest = hash_token(token)
    return (
        ConsentimientoInformado.objects.select_related("paciente", "psicologo")
        .filter(token_hash=token_digest)
        .first()
    )
