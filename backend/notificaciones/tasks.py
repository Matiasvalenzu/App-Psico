import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import NotificacionEmail
from .services import notification_content, send_branded_email

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
SENDING_TIMEOUT = timedelta(minutes=10)


@shared_task(bind=True, max_retries=4)
def send_notification(self, notification_id):
    now = timezone.now()
    with transaction.atomic():
        notification = NotificacionEmail.objects.select_for_update().get(
            pk=notification_id
        )
        if notification.estado == NotificacionEmail.Estado.ENVIADA:
            return "already-sent"
        if (
            notification.estado == NotificacionEmail.Estado.ENVIANDO
            and notification.updated_at > now - SENDING_TIMEOUT
        ):
            return "already-processing"
        if notification.intentos >= MAX_ATTEMPTS:
            return "attempts-exhausted"

        notification.estado = NotificacionEmail.Estado.ENVIANDO
        notification.intentos += 1
        notification.proximo_intento_at = None
        notification.save(
            update_fields=["estado", "intentos", "proximo_intento_at", "updated_at"]
        )

    notification = NotificacionEmail.objects.select_related(
        "usuario",
        "cita__psicologo",
        "cita__paciente",
        "cita__reserva_publica__perfil",
        "evento_reserva",
    ).get(pk=notification_id)

    try:
        content = notification_content(notification)
        send_branded_email(
            subject=content["subject"],
            recipient=notification.destinatario,
            template_name=content["template"],
            context=content["context"],
            reply_to=notification.responder_a or None,
        )
    except Exception as exc:
        logger.exception("Falló el envío de la notificación %s", notification_id)
        delay = min(60 * (2 ** max(notification.intentos - 1, 0)), 3600)
        retry_at = timezone.now() + timedelta(seconds=delay)
        NotificacionEmail.objects.filter(pk=notification_id).update(
            estado=NotificacionEmail.Estado.ERROR,
            proximo_intento_at=retry_at if notification.intentos < MAX_ATTEMPTS else None,
            ultimo_error=type(exc).__name__[:120],
            updated_at=timezone.now(),
        )
        if notification.intentos < MAX_ATTEMPTS:
            raise self.retry(exc=exc, countdown=delay)
        return "failed"

    NotificacionEmail.objects.filter(pk=notification_id).update(
        estado=NotificacionEmail.Estado.ENVIADA,
        enviada_at=timezone.now(),
        ultimo_error="",
        proximo_intento_at=None,
        updated_at=timezone.now(),
    )
    return "sent"


@shared_task
def dispatch_pending_notifications():
    now = timezone.now()
    pending_ids = list(
        NotificacionEmail.objects.filter(intentos__lt=MAX_ATTEMPTS)
        .filter(
            Q(estado=NotificacionEmail.Estado.PENDIENTE)
            | Q(
                estado=NotificacionEmail.Estado.ERROR,
                proximo_intento_at__lte=now,
            )
            | Q(
                estado=NotificacionEmail.Estado.ENVIANDO,
                updated_at__lt=now - SENDING_TIMEOUT,
            )
        )
        .values_list("pk", flat=True)[:100]
    )
    for notification_id in pending_ids:
        send_notification.delay(notification_id)
    return len(pending_ids)
