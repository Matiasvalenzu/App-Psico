import logging
from datetime import timedelta
from email.mime.image import MIMEImage
from email.utils import formataddr, parseaddr
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.formats import date_format

from .models import NotificacionEmail

logger = logging.getLogger(__name__)
LOGO_CID = "psiconex-logo"
LOGO_PATH = Path(__file__).resolve().parent / "assets" / "logo-psiconex.png"


def _sender_address():
    configured = settings.DEFAULT_FROM_EMAIL
    address = parseaddr(configured)[1] or configured
    return formataddr((settings.EMAIL_FROM_NAME, address))


def _common_context(context):
    return {
        **context,
        "app_url": settings.PUBLIC_APP_URL.rstrip("/"),
        "email_logo_url": f"cid:{LOGO_CID}",
        "support_email": settings.EMAIL_SUPPORT_ADDRESS,
        "current_year": timezone.localdate().year,
    }


def send_branded_email(*, subject, recipient, template_name, context, reply_to=None):
    context = _common_context(context)
    text_body = render_to_string(
        f"notificaciones/email/{template_name}.txt", context
    ).strip()
    html_body = render_to_string(
        f"notificaciones/email/{template_name}.html", context
    )
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=_sender_address(),
        to=[recipient],
        reply_to=[reply_to] if reply_to else None,
    )
    message.attach_alternative(html_body, "text/html")
    logo = MIMEImage(LOGO_PATH.read_bytes(), _subtype="png")
    logo.add_header("Content-ID", f"<{LOGO_CID}>")
    logo.add_header("Content-Disposition", "inline", filename=LOGO_PATH.name)
    message.mixed_subtype = "related"
    message.attach(logo)
    return message.send(fail_silently=False)


def _dispatch_after_commit(notification_id):
    from .tasks import send_notification

    try:
        send_notification.delay(notification_id)
    except Exception:
        logger.exception("No se pudo encolar la notificación %s", notification_id)


def _schedule(notification):
    transaction.on_commit(
        lambda: _dispatch_after_commit(notification.pk),
        robust=True,
    )


def enqueue_welcome_email(user):
    recipient = (user.email or "").strip().lower()
    if not recipient:
        return None

    notification, created = NotificacionEmail.objects.get_or_create(
        clave_deduplicacion=f"bienvenida:usuario:{user.pk}",
        defaults={
            "tipo": NotificacionEmail.Tipo.BIENVENIDA,
            "destinatario": recipient,
            "responder_a": settings.EMAIL_SUPPORT_ADDRESS,
            "usuario": user,
        },
    )
    if created:
        _schedule(notification)
    return notification


def enqueue_session_ready_email(sesion):
    """Avisa al psicólogo que la transcripción de su sesión terminó.

    Sin datos clínicos: el correo solo lleva un enlace (exige iniciar sesión).
    Idempotente por sesión mediante la clave de deduplicación.
    """
    from cuentas.services import get_notification_email

    if not sesion.psicologo_id:
        return None
    recipient = get_notification_email(sesion.psicologo)
    if not recipient:
        return None

    notification, created = NotificacionEmail.objects.get_or_create(
        clave_deduplicacion=f"sesion_lista:{sesion.pk}",
        defaults={
            "tipo": NotificacionEmail.Tipo.SESION_LISTA,
            "destinatario": recipient,
            "responder_a": settings.EMAIL_SUPPORT_ADDRESS,
            "usuario_id": sesion.psicologo_id,
        },
    )
    if created:
        _schedule(notification)
    return notification


def enqueue_purge_notice(suscripcion, dias):
    """Avisa que la cuenta inactiva se eliminará en `dias` (7 o 1).

    La clave incluye la fecha de purga: si la cuenta se reactiva y vuelve a
    quedar inactiva, corresponde un aviso nuevo.
    """
    from cuentas.services import get_notification_email

    user = suscripcion.user
    recipient = get_notification_email(user) or (user.email or "").strip().lower()
    if not recipient or not suscripcion.fecha_purga:
        return None
    tipo = (
        NotificacionEmail.Tipo.AVISO_PURGA_7D if dias == 7 else NotificacionEmail.Tipo.AVISO_PURGA_1D
    )
    notification, created = NotificacionEmail.objects.get_or_create(
        clave_deduplicacion=f"aviso_purga:{dias}d:{user.pk}:{int(suscripcion.fecha_purga.timestamp())}",
        defaults={
            "tipo": tipo,
            "destinatario": recipient,
            "responder_a": settings.EMAIL_SUPPORT_ADDRESS,
            "usuario": user,
        },
    )
    if created:
        _schedule(notification)
    return notification


def _clave_recordatorio(cita):
    return f"recordatorio:{cita.pk}:{int(cita.inicio.timestamp())}"


def _email_paciente_cita(cita):
    try:
        email = cita.reserva_publica.email_confirmacion
    except ObjectDoesNotExist:
        email = ""
    if not email and cita.paciente_id:
        email = cita.paciente.email_contacto
    return (email or cita.prospecto_email or "").strip().lower()


def enqueue_appointment_reminders():
    """Encola el recordatorio de las citas que empiezan en ~24 h.

    La clave incluye el inicio: si la cita se reagenda, corresponde otro
    recordatorio. Se corre cada 15 min, por eso la ventana es de 2 h.
    """
    from agenda.models import AgendaCita
    from cuentas.services import get_notification_email

    ahora = timezone.now()
    citas = (
        AgendaCita.objects.filter(
            inicio__gte=ahora + timedelta(hours=23), inicio__lt=ahora + timedelta(hours=25)
        )
        .exclude(estado=AgendaCita.Estado.ANULADA)
        .exclude(psicologo__perfil_psicologo__recordatorios_paciente_activos=False)
        .select_related("psicologo", "paciente", "reserva_publica")
    )
    creadas = 0
    for cita in citas:
        recipient = _email_paciente_cita(cita)
        if not recipient:
            continue
        notification, created = NotificacionEmail.objects.get_or_create(
            clave_deduplicacion=_clave_recordatorio(cita),
            defaults={
                "tipo": NotificacionEmail.Tipo.RECORDATORIO_CITA,
                "destinatario": recipient,
                "responder_a": get_notification_email(cita.psicologo)
                or settings.EMAIL_SUPPORT_ADDRESS,
                "cita": cita,
            },
        )
        if created:
            creadas += 1
            _schedule(notification)
    return creadas


def enqueue_booking_confirmations(cita, patient_email):
    from cuentas.services import get_notification_email

    patient_email = patient_email.strip().lower()
    psychologist_email = get_notification_email(cita.psicologo)
    if not patient_email or not psychologist_email:
        raise ValueError("La reserva requiere emails válidos para paciente y psicólogo.")

    definitions = [
        {
            "key": f"reserva:{cita.pk}:paciente",
            "type": NotificacionEmail.Tipo.RESERVA_PACIENTE,
            "recipient": patient_email,
            "reply_to": psychologist_email,
        },
        {
            "key": f"reserva:{cita.pk}:psicologo",
            "type": NotificacionEmail.Tipo.RESERVA_PSICOLOGO,
            "recipient": psychologist_email,
            "reply_to": patient_email,
        },
    ]
    notifications = []
    for definition in definitions:
        notification, created = NotificacionEmail.objects.get_or_create(
            clave_deduplicacion=definition["key"],
            defaults={
                "tipo": definition["type"],
                "destinatario": definition["recipient"],
                "responder_a": definition["reply_to"],
                "cita": cita,
            },
        )
        notifications.append(notification)
        if created:
            _schedule(notification)
    return notifications


def enqueue_booking_change_notifications(event):
    from cuentas.services import get_notification_email

    reservation = event.reserva
    patient_email = reservation.email_confirmacion.strip().lower()
    psychologist_email = get_notification_email(reservation.cita.psicologo)
    if not patient_email or not psychologist_email:
        raise ValueError("La reserva requiere emails válidos para paciente y psicólogo.")

    is_reschedule = event.tipo == "REPROGRAMADA"
    definitions = [
        {
            "key": f"reserva-evento:{event.pk}:paciente",
            "type": (
                NotificacionEmail.Tipo.REPROGRAMACION_PACIENTE
                if is_reschedule
                else NotificacionEmail.Tipo.CANCELACION_PACIENTE
            ),
            "recipient": patient_email,
            "reply_to": psychologist_email,
        },
        {
            "key": f"reserva-evento:{event.pk}:psicologo",
            "type": (
                NotificacionEmail.Tipo.REPROGRAMACION_PSICOLOGO
                if is_reschedule
                else NotificacionEmail.Tipo.CANCELACION_PSICOLOGO
            ),
            "recipient": psychologist_email,
            "reply_to": patient_email,
        },
    ]
    notifications = []
    for definition in definitions:
        notification, created = NotificacionEmail.objects.get_or_create(
            clave_deduplicacion=definition["key"],
            defaults={
                "tipo": definition["type"],
                "destinatario": definition["recipient"],
                "responder_a": definition["reply_to"],
                "cita": reservation.cita,
                "evento_reserva": event,
            },
        )
        notifications.append(notification)
        if created:
            _schedule(notification)
    return notifications


def notification_content(notification):
    if notification.tipo == NotificacionEmail.Tipo.BIENVENIDA:
        user = notification.usuario
        if not user:
            raise ValueError("La notificación de bienvenida no tiene usuario.")
        subscription = getattr(user, "suscripcion", None)
        trial_end = getattr(subscription, "fin_prueba", None)
        trial_end_text = (
            date_format(timezone.localtime(trial_end), "j \\d\\e F \\d\\e Y")
            if trial_end
            else "14 días después de tu registro"
        )
        first_name = user.first_name.strip() or user.get_full_name().strip() or user.username
        return {
            "subject": "Bienvenido/a a Psiconex: comienza tus 14 días de prueba",
            "template": "bienvenida",
            "context": {
                "first_name": first_name,
                "trial_end": trial_end_text,
                "dashboard_url": f"{settings.PUBLIC_APP_URL.rstrip('/')}/dashboard",
            },
        }

    if notification.tipo == NotificacionEmail.Tipo.SESION_LISTA:
        from sesiones.models import Sesion

        try:
            session_id = int(notification.clave_deduplicacion.split(":", 1)[1])
            sesion = Sesion.objects.only("id", "paciente_id").get(pk=session_id)
        except (IndexError, ValueError, Sesion.DoesNotExist):
            raise ValueError("La notificación de sesión lista no tiene sesión válida.")
        base_url = settings.PUBLIC_APP_URL.rstrip("/")
        return {
            "subject": "Tu sesión está lista en Psiconex",
            "template": "sesion_lista",
            "context": {
                "session_url": (
                    f"{base_url}/dashboard/pacientes/{sesion.paciente_id}"
                    f"/sesiones/{sesion.pk}"
                ),
            },
        }

    if notification.tipo in (
        NotificacionEmail.Tipo.AVISO_PURGA_7D,
        NotificacionEmail.Tipo.AVISO_PURGA_1D,
    ):
        user = notification.usuario
        suscripcion = getattr(user, "suscripcion", None) if user else None
        if not suscripcion or suscripcion.puede_escribir or not suscripcion.fecha_purga:
            return None  # La cuenta se reactivó (o ya no existe): no hay nada que avisar.
        base_url = settings.PUBLIC_APP_URL.rstrip("/")
        first_name = user.first_name.strip() or user.get_full_name().strip() or user.username
        dias = 7 if notification.tipo == NotificacionEmail.Tipo.AVISO_PURGA_7D else 1
        return {
            "subject": (
                "Tus datos en Psiconex se eliminarán mañana"
                if dias == 1
                else "Tus datos en Psiconex se eliminarán en 7 días"
            ),
            "template": "aviso_purga",
            "context": {
                "first_name": first_name,
                "dias": dias,
                "fecha_purga": date_format(
                    timezone.localtime(suscripcion.fecha_purga), "j \\d\\e F \\d\\e Y"
                ),
                "export_url": f"{base_url}/dashboard/configuracion/privacidad",
                "reactivate_url": f"{base_url}/dashboard/suscripcion",
            },
        }

    cita = notification.cita
    if notification.tipo == NotificacionEmail.Tipo.RECORDATORIO_CITA:
        perfil = getattr(cita.psicologo, "perfil_psicologo", None) if cita else None
        if (
            not cita
            or cita.estado == cita.Estado.ANULADA
            or notification.clave_deduplicacion != _clave_recordatorio(cita)
            or (perfil and not perfil.recordatorios_paciente_activos)
        ):
            return None
    if not cita:
        raise ValueError("La notificación de reserva no tiene cita.")

    inicio = timezone.localtime(cita.inicio)
    fin = timezone.localtime(cita.fin)
    try:
        profile = cita.reserva_publica.perfil
    except (AttributeError, ObjectDoesNotExist):
        profile = None

    psychologist_name = (
        getattr(profile, "nombre_publico", "")
        or cita.psicologo.get_full_name()
        or cita.psicologo.username
    )
    patient_name = (
        cita.paciente.nombre_completo
        if cita.paciente_id
        else f"{cita.prospecto_nombre} {cita.prospecto_apellido}".strip()
    )
    context = {
        "patient_name": patient_name,
        "psychologist_name": psychologist_name,
        "appointment_date": date_format(inicio, "l j \\d\\e F \\d\\e Y").capitalize(),
        "appointment_start": inicio.strftime("%H:%M"),
        "appointment_end": fin.strftime("%H:%M"),
        "duration_minutes": int((cita.fin - cita.inicio).total_seconds() // 60),
        "booking_instructions": (
            getattr(profile, "instrucciones_reserva", "").strip() if profile else ""
        ),
        "agenda_url": f"{settings.PUBLIC_APP_URL.rstrip('/')}/dashboard/agenda",
        "booking_code": getattr(getattr(cita, "reserva_publica", None), "codigo_reserva", ""),
        "management_url": (
            f"{settings.PUBLIC_APP_URL.rstrip('/')}/reservar/{profile.slug}?gestionar=1"
            if profile
            else ""
        ),
    }
    if notification.tipo == NotificacionEmail.Tipo.RECORDATORIO_CITA:
        return {
            "subject": f"Recordatorio: tu sesión con {psychologist_name} es mañana",
            "template": "recordatorio_cita",
            "context": context,
        }
    if notification.tipo == NotificacionEmail.Tipo.RESERVA_PACIENTE:
        return {
            "subject": f"Reserva confirmada con {psychologist_name}",
            "template": "reserva_paciente",
            "context": context,
        }
    if notification.tipo == NotificacionEmail.Tipo.RESERVA_PSICOLOGO:
        return {
            "subject": f"Nueva reserva: {patient_name} - {inicio.strftime('%d/%m %H:%M')}",
            "template": "reserva_psicologo",
            "context": context,
        }
    if notification.tipo in {
        NotificacionEmail.Tipo.REPROGRAMACION_PACIENTE,
        NotificacionEmail.Tipo.REPROGRAMACION_PSICOLOGO,
        NotificacionEmail.Tipo.CANCELACION_PACIENTE,
        NotificacionEmail.Tipo.CANCELACION_PSICOLOGO,
    }:
        event = notification.evento_reserva
        if not event:
            raise ValueError("La notificación de cambio no tiene evento de reserva.")
        is_reschedule = event.tipo == "REPROGRAMADA"
        event_start = event.inicio_nuevo if is_reschedule else event.inicio_anterior
        previous_start = event.inicio_anterior
        event_start = timezone.localtime(event_start)
        previous_start = timezone.localtime(previous_start) if previous_start else None
        context.update(
            {
                "appointment_date": date_format(
                    event_start, "l j \\d\\e F \\d\\e Y"
                ).capitalize(),
                "appointment_start": event_start.strftime("%H:%M"),
                "previous_date": (
                    date_format(previous_start, "l j \\d\\e F \\d\\e Y").capitalize()
                    if previous_start
                    else ""
                ),
                "previous_start": previous_start.strftime("%H:%M") if previous_start else "",
                "change_action": "reprogramada" if is_reschedule else "cancelada",
                "is_reschedule": is_reschedule,
            }
        )
        for_patient = notification.tipo in {
            NotificacionEmail.Tipo.REPROGRAMACION_PACIENTE,
            NotificacionEmail.Tipo.CANCELACION_PACIENTE,
        }
        return {
            "subject": (
                f"Reserva {'reprogramada' if is_reschedule else 'cancelada'} con {psychologist_name}"
                if for_patient
                else f"Reserva {'reprogramada' if is_reschedule else 'cancelada'}: {patient_name}"
            ),
            "template": (
                "cambio_reserva_paciente" if for_patient else "cambio_reserva_psicologo"
            ),
            "context": context,
        }
    raise ValueError(f"Tipo de notificación no soportado: {notification.tipo}")


def send_meet_invitation_to_patient(*, sesion, recipient_email=None):
    from cuentas.services import get_notification_email

    paciente = sesion.paciente
    psicologo = sesion.psicologo
    recipient = (recipient_email or paciente.email_contacto or "").strip()
    if not recipient:
        raise ValueError("El paciente no tiene un correo electrónico registrado.")

    if not sesion.url_reunion:
        raise ValueError("La sesión no tiene un enlace de reunión configurado.")

    psychologist_name = psicologo.get_full_name() or psicologo.username or "Tu profesional"
    psychologist_email = get_notification_email(psicologo)

    fecha_str = ""
    hora_str = ""
    if sesion.fecha_hora_inicio:
        local_dt = timezone.localtime(sesion.fecha_hora_inicio)
        fecha_str = date_format(local_dt, "l j \\d\\e F \\d\\e Y").capitalize()
        hora_str = local_dt.strftime("%H:%M")

    context = {
        "patient_name": paciente.nombre or "Estimado/a",
        "psychologist_name": psychologist_name,
        "meet_url": sesion.url_reunion,
        "platform_name": sesion.get_plataforma_virtual_display() if sesion.plataforma_virtual else "Google Meet",
        "session_date": fecha_str,
        "session_time": hora_str,
    }

    return send_branded_email(
        subject=f"Enlace para tu sesión psicológica con {psychologist_name}",
        recipient=recipient,
        template_name="invitacion_meet",
        context=context,
        reply_to=psychologist_email or None,
    )
