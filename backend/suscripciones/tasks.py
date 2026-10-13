import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import ESTADOS_INACTIVOS, Suscripcion

logger = logging.getLogger(__name__)


def _exenta(user):
    return user.is_staff or user.is_superuser or user.username == "Admin"


@shared_task
def ciclo_suscripciones():
    """Diaria: expira trials vencidos, avisa a 7 y 1 día de la purga y purga al cumplirse."""
    from cuentas.services import eliminar_cuenta
    from notificaciones.services import enqueue_purge_notice

    for suscripcion in Suscripcion.objects.filter(estado="trial", fin_prueba__lte=timezone.now()):
        suscripcion.expirar_si_vencida()

    avisos = purgadas = 0
    ahora = timezone.now()
    inactivas = Suscripcion.objects.filter(
        estado__in=ESTADOS_INACTIVOS, inactiva_desde__isnull=False
    ).select_related("user")
    for suscripcion in inactivas:
        user = suscripcion.user
        if _exenta(user) or suscripcion.puede_escribir:
            continue
        if suscripcion.fecha_purga <= ahora:
            if settings.PURGA_ACTIVA:
                logger.warning("Purgando cuenta inactiva %s (id %s)", user.username, user.pk)
                eliminar_cuenta(user)
                purgadas += 1
            else:
                logger.warning(
                    "PURGA_ACTIVA=False: se omitió purgar la cuenta inactiva %s (id %s)",
                    user.username,
                    user.pk,
                )
            continue
        dias = suscripcion.dias_para_purga
        if dias <= 1:
            avisos += bool(enqueue_purge_notice(suscripcion, 1))
        elif dias <= 7:
            avisos += bool(enqueue_purge_notice(suscripcion, 7))
    return {"avisos": avisos, "purgadas": purgadas}


@shared_task
def avisar_pago_plus_sin_vincular(pendiente_id):
    """Si a la media hora del webhook nadie reclamó el pago de Plus, se avisa a los admins para no perderlo."""
    from facturacion.bhe import avisar_admins
    from .models import PagoPlusPendiente

    pendiente = PagoPlusPendiente.objects.filter(pk=pendiente_id, vinculado_a__isnull=True).first()
    if not pendiente or Suscripcion.objects.filter(mp_preapproval_id=pendiente.mp_preapproval_id).exists():
        return
    enlace = f"{settings.PUBLIC_APP_URL.rstrip('/')}/suscripcionok?preapproval_id={pendiente.mp_preapproval_id}"
    avisar_admins(
        "Pago de Plan Plus sin cuenta asociada",
        "Alguien se suscribió a Plus con el enlace de Mercado Pago y no volvió a la app, así que el pago no quedó "
        f"asociado a ninguna cuenta (estado en MP: {pendiente.estado_mp}). Cuando la persona escriba, pídele que "
        f"abra este enlace con su sesión iniciada y Plus queda activo:\n\n{enlace}\n\n"
        "Lo ves también en el admin, en «Pagos Plus sin vincular».",
    )
    logger.warning(f"Pago Plus sin vincular #{pendiente.pk} ({pendiente.estado_mp})")
