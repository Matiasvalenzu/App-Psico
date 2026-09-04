import logging
from django.conf import settings
from notificaciones.services import send_branded_email

logger = logging.getLogger(__name__)


def notificar_nuevo_feedback(reporte):
    """
    Envía notificación por email al equipo de soporte y confirmación al usuario.
    """
    support_recipient = getattr(settings, "EMAIL_SUPPORT_ADDRESS", "psiconex@datnexia.com")
    
    # 1. Notificar al equipo de soporte
    try:
        send_branded_email(
            subject=f"[Feedback Psiconex #{reporte.id}] {reporte.get_tipo_display()}: {reporte.titulo}",
            recipient=support_recipient,
            template_name="feedback_admin",
            context={"reporte": reporte},
            reply_to=reporte.usuario.email if reporte.usuario.email else None,
        )
    except Exception as e:
        logger.warning("No se pudo enviar email de feedback a soporte (%s): %s", support_recipient, e)

    # 2. Enviar confirmación al usuario (si tiene email válido)
    if reporte.usuario.email:
        try:
            send_branded_email(
                subject=f"Hemos recibido tu feedback: {reporte.titulo}",
                recipient=reporte.usuario.email,
                template_name="feedback_confirmacion",
                context={"reporte": reporte},
            )
        except Exception as e:
            logger.warning("No se pudo enviar confirmación de feedback al usuario (%s): %s", reporte.usuario.email, e)


def notificar_actualizacion_feedback(reporte):
    """
    Envía notificación por email al usuario cuando su reporte cambia de estado o recibe respuesta.
    """
    if not reporte.usuario.email:
        return

    try:
        send_branded_email(
            subject=f"Actualización de tu reporte #{reporte.id}: {reporte.titulo}",
            recipient=reporte.usuario.email,
            template_name="feedback_actualizado",
            context={"reporte": reporte},
        )
    except Exception as e:
        logger.warning("No se pudo enviar email de actualización de reporte al usuario (%s): %s", reporte.usuario.email, e)
