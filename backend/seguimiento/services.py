import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def generar_token():
    return secrets.token_urlsafe(32)


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def url_publica(ruta):
    base = getattr(settings, "PUBLIC_APP_URL", "http://localhost:3000").strip()
    if not base.startswith(("http://", "https://")):
        base = f"https://{base}"
    return f"{base.rstrip('/')}/{ruta.lstrip('/')}"


def telefono_wa(telefono):
    import re

    d = re.sub(r"\D", "", telefono or "")
    if d.startswith("56") and len(d) == 11 and d[2] == "9":
        return d
    if len(d) == 9 and d.startswith("9"):
        return f"56{d}"
    return ""


def enlace_whatsapp(telefono, texto):
    """Solo construye un enlace wa.me; el psicólogo decide si lo abre y envía. Nunca envía nada."""
    tel = telefono_wa(telefono)
    if not tel:
        return ""
    return f"https://wa.me/{tel}?text={quote(texto)}"


def notificar_psicologo(psicologo, paciente_id):
    """Correo al psicólogo (nunca al paciente), sin datos clínicos."""
    perfil = getattr(psicologo, "perfil_psicologo", None)
    destino = (getattr(perfil, "email_notificaciones", "") if perfil else "") or psicologo.email
    if not destino:
        return

    def _enviar():
        try:
            from notificaciones.services import send_branded_email

            send_branded_email(
                subject="Revisa un registro reciente en Psiconex",
                recipient=destino,
                template_name="alerta_seguimiento",
                context={"ficha_url": url_publica(f"/dashboard/pacientes/{paciente_id}?tab=escalas")},
            )
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo enviar la alerta de seguimiento al psicólogo")

    transaction.on_commit(_enviar)


def expiracion(dias):
    return timezone.now() + timedelta(days=dias)
