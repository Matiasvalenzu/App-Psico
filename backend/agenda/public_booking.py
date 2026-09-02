import hmac
import secrets
from datetime import timedelta

from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from pacientes.models import Paciente
from notificaciones.services import send_branded_email

from .models import (
    AgendaCita,
    AgendaPerfilPublico,
    AgendaReservaEvento,
    AgendaReservaPublica,
    AgendaVerificacionReserva,
)
from .security import (
    compare_digest,
    document_digest,
    generate_booking_code,
    otp_digest,
    sign_email_verification,
    sign_reservation_access,
    unsign_email_verification,
    unsign_reservation_access,
)
from .serializers import calcular_slots


OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


class ReservationConflict(Exception):
    pass


def _mask_email(email):
    local, domain = email.split("@", 1)
    visible = local[:2]
    return f"{visible}{'*' * max(3, len(local) - len(visible))}@{domain}"


def _find_patient(profile, document_type, normalized_document):
    return Paciente.objects.filter(
        psicologo=profile.psicologo,
        tipo_documento=document_type,
        documento_normalizado=normalized_document,
        activo=True,
    ).first()


def request_booking_email_verification(profile, data, request_ip_hash):
    document_type = data["tipo_documento"]
    normalized_document = data["documento_normalizado"]
    patient = _find_patient(profile, document_type, normalized_document)
    deliver_code = True
    if data["tipo_paciente"] == AgendaReservaPublica.TipoPaciente.EXISTENTE:
        if not patient or not patient.email_contacto:
            recipient = "unavailable@invalid.psiconex.local"
            deliver_code = False
        else:
            recipient = patient.email_contacto.strip().lower()
    else:
        if patient:
            recipient = "unavailable@invalid.psiconex.local"
            patient = None
            deliver_code = False
        else:
            recipient = data["email"]

    verification = AgendaVerificacionReserva.objects.create(
        perfil=profile,
        paciente=patient,
        tipo_paciente=data["tipo_paciente"],
        tipo_documento=document_type,
        documento_digest=document_digest(
            profile.pk, document_type, normalized_document
        ),
        email=recipient,
        codigo_hash="",
        expira_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
        ip_hash=request_ip_hash,
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    verification.codigo_hash = otp_digest(verification.public_id, code)
    verification.save(update_fields=["codigo_hash"])
    try:
        from cuentas.services import get_notification_email

        if deliver_code:
            send_branded_email(
                subject="Código para confirmar tu reserva en Psiconex",
                recipient=recipient,
                template_name="otp_reserva",
                context={
                    "verification_code": code,
                    "expiration_minutes": OTP_TTL_MINUTES,
                    "psychologist_name": profile.nombre_publico,
                },
                reply_to=get_notification_email(profile.psicologo),
            )
    except Exception:
        verification.delete()
        raise serializers.ValidationError(
            "No pudimos enviar el código de verificación. Intenta nuevamente."
        )
    destination = (
        "tu correo registrado"
        if data["tipo_paciente"] == AgendaReservaPublica.TipoPaciente.EXISTENTE
        else _mask_email(data["email"])
    )
    return verification, destination


def confirm_booking_email_verification(profile, verification_id, code):
    error = None
    with transaction.atomic():
        verification = AgendaVerificacionReserva.objects.select_for_update().filter(
            public_id=verification_id,
            perfil=profile,
        ).first()
        if not verification or verification.expira_at <= timezone.now():
            error = "El código expiró. Solicita uno nuevo."
        elif verification.intentos >= OTP_MAX_ATTEMPTS:
            error = "Superaste el máximo de intentos."
        else:
            received = otp_digest(verification.public_id, code)
            if not compare_digest(verification.codigo_hash, received):
                verification.intentos += 1
                verification.save(update_fields=["intentos"])
                error = "El código ingresado no es válido."
            else:
                verification.verificada_at = timezone.now()
                verification.save(update_fields=["verificada_at"])
    if error:
        raise serializers.ValidationError(error)
    return sign_email_verification(verification.public_id)


def consume_booking_verification(
    profile, token, patient_type, document_type, normalized_document
):
    try:
        payload = unsign_email_verification(token)
    except signing.BadSignature:
        raise serializers.ValidationError("La verificación del correo expiró.")
    verification = AgendaVerificacionReserva.objects.select_for_update().filter(
        public_id=payload.get("verification_id"),
        perfil=profile,
        tipo_paciente=patient_type,
        verificada_at__isnull=False,
        consumida_at__isnull=True,
    ).first()
    if not verification or verification.expira_at <= timezone.now():
        raise serializers.ValidationError("La verificación del correo expiró.")
    expected_document = document_digest(
        profile.pk, document_type, normalized_document
    )
    if (
        verification.tipo_documento != document_type
        or not hmac.compare_digest(verification.documento_digest, expected_document)
    ):
        raise serializers.ValidationError("La verificación no corresponde al documento indicado.")
    verification.consumida_at = timezone.now()
    verification.save(update_fields=["consumida_at"])
    return verification


def assign_booking_code(reservation):
    for _ in range(5):
        code = generate_booking_code()
        if not AgendaReservaPublica.objects.filter(codigo_reserva=code).exists():
            reservation.codigo_reserva = code
            return code
    raise RuntimeError("No se pudo generar un código de reserva único.")


def create_booking_event(reservation, request):
    return AgendaReservaEvento.objects.create(
        reserva=reservation,
        tipo=AgendaReservaEvento.Tipo.CREADA,
        actor=AgendaReservaEvento.Actor.PACIENTE,
        inicio_nuevo=reservation.cita.inicio,
        fin_nuevo=reservation.cita.fin,
        estado_nuevo=reservation.cita.estado,
        version=reservation.version,
        ip_hash=request_ip_hash(request),
        user_agent=(request.META.get("HTTP_USER_AGENT", ""))[:300],
    )


def request_ip_hash(request):
    from .serializers import ip_hash

    return ip_hash(request)


def authenticate_reservation(profile, data):
    reservation = (
        AgendaReservaPublica.objects.select_related("cita", "paciente", "perfil")
        .filter(codigo_reserva=data["codigo_reserva"], perfil=profile)
        .first()
    )
    if not reservation:
        raise serializers.ValidationError("Los datos de la reserva no son válidos.")
    received = document_digest(
        profile.pk, data["tipo_documento"], data["documento_normalizado"]
    )
    if not hmac.compare_digest(reservation.documento_digest, received):
        raise serializers.ValidationError("Los datos de la reserva no son válidos.")
    reservation.ultima_gestion_at = timezone.now()
    reservation.save(update_fields=["ultima_gestion_at"])
    return sign_reservation_access(reservation.pk, reservation.version), reservation_payload(
        reservation
    )


def get_managed_reservation(profile, token, for_update=False):
    try:
        payload = unsign_reservation_access(token)
    except signing.BadSignature:
        raise serializers.ValidationError("La sesión de gestión expiró. Identifícate nuevamente.")
    queryset = AgendaReservaPublica.objects.select_related(
        "cita", "paciente", "perfil", "cita__psicologo"
    )
    if for_update:
        queryset = queryset.select_for_update(of=("self",))
    reservation = queryset.filter(
        pk=payload.get("reservation_id"), perfil=profile
    ).first()
    if not reservation:
        raise serializers.ValidationError("La reserva no está disponible.")
    return reservation


def reservation_payload(reservation):
    appointment = reservation.cita
    start = timezone.localtime(appointment.inicio)
    end = timezone.localtime(appointment.fin)
    deadline = appointment.inicio - timedelta(
        hours=reservation.perfil.anticipacion_cambios_horas
    )
    return {
        "codigo_reserva": reservation.codigo_reserva,
        "paciente_nombre": reservation.paciente.nombre_completo,
        "profesional_nombre": reservation.perfil.nombre_publico,
        "inicio": start.isoformat(),
        "fin": end.isoformat(),
        "duracion_minutos": int(
            (appointment.fin - appointment.inicio).total_seconds() // 60
        ),
        "estado": appointment.estado,
        "version": reservation.version,
        "puede_modificar": (
            appointment.estado != AgendaCita.Estado.ANULADA
            and timezone.now() < deadline
        ),
        "cambios_hasta": timezone.localtime(deadline).isoformat(),
        "instrucciones": reservation.perfil.instrucciones_reserva,
    }


def management_slots(profile, token, start_date, end_date):
    reservation = get_managed_reservation(profile, token)
    appointment = reservation.cita
    duration_minutes = int((appointment.fin - appointment.inicio).total_seconds() // 60)
    return calcular_slots(
        profile,
        start_date,
        end_date,
        exclude_cita_id=appointment.pk,
        duration_minutes=duration_minutes,
    )


def _schedule_side_effects(event):
    from notificaciones.services import enqueue_booking_change_notifications
    from .tasks import sync_appointment_to_google

    enqueue_booking_change_notifications(event)
    transaction.on_commit(
        lambda: sync_appointment_to_google.delay(event.reserva.cita_id), robust=True
    )


@transaction.atomic
def reschedule_reservation(profile, data, request):
    reservation = get_managed_reservation(profile, data["token"], for_update=True)
    existing = reservation.eventos.filter(request_id=data["request_id"]).first()
    if existing:
        return reservation_payload(reservation)
    if reservation.version != data["version"]:
        raise ReservationConflict("La reserva cambió. Actualiza los datos e intenta nuevamente.")
    appointment = AgendaCita.objects.select_for_update().get(pk=reservation.cita_id)
    if appointment.estado == AgendaCita.Estado.ANULADA:
        raise serializers.ValidationError("La reserva está cancelada.")
    if timezone.now() >= appointment.inicio - timedelta(
        hours=profile.anticipacion_cambios_horas
    ):
        raise serializers.ValidationError("El plazo para reagendar esta reserva ya finalizó.")

    duration_minutes = int((appointment.fin - appointment.inicio).total_seconds() // 60)
    requested_start = data["inicio"]
    valid_slots = calcular_slots(
        profile,
        requested_start.date(),
        requested_start.date(),
        exclude_cita_id=appointment.pk,
        duration_minutes=duration_minutes,
    )
    if not any(parse_datetime(slot["inicio"]) == requested_start for slot in valid_slots):
        raise ReservationConflict("El horario seleccionado ya no está disponible.")

    old_start, old_end = appointment.inicio, appointment.fin
    appointment.inicio = requested_start
    appointment.fin = requested_start + timedelta(minutes=duration_minutes)
    appointment.estado = AgendaCita.Estado.CONFIRMADA
    appointment.save(update_fields=["inicio", "fin", "estado", "updated_at"])
    reservation.version += 1
    reservation.ultima_gestion_at = timezone.now()
    reservation.save(update_fields=["version", "ultima_gestion_at"])
    event = AgendaReservaEvento.objects.create(
        reserva=reservation,
        tipo=AgendaReservaEvento.Tipo.REPROGRAMADA,
        actor=AgendaReservaEvento.Actor.PACIENTE,
        inicio_anterior=old_start,
        fin_anterior=old_end,
        inicio_nuevo=appointment.inicio,
        fin_nuevo=appointment.fin,
        estado_anterior=AgendaCita.Estado.CONFIRMADA,
        estado_nuevo=appointment.estado,
        version=reservation.version,
        ip_hash=request_ip_hash(request),
        user_agent=(request.META.get("HTTP_USER_AGENT", ""))[:300],
        request_id=data["request_id"],
    )
    reservation.cita = appointment
    _schedule_side_effects(event)
    return reservation_payload(reservation)


@transaction.atomic
def cancel_reservation(profile, data, request):
    reservation = get_managed_reservation(profile, data["token"], for_update=True)
    existing = reservation.eventos.filter(request_id=data["request_id"]).first()
    if existing:
        return reservation_payload(reservation)
    if reservation.version != data["version"]:
        raise ReservationConflict("La reserva cambió. Actualiza los datos e intenta nuevamente.")
    appointment = AgendaCita.objects.select_for_update().get(pk=reservation.cita_id)
    if appointment.estado == AgendaCita.Estado.ANULADA:
        return reservation_payload(reservation)
    if timezone.now() >= appointment.inicio - timedelta(
        hours=profile.anticipacion_cambios_horas
    ):
        raise serializers.ValidationError("El plazo para cancelar esta reserva ya finalizó.")

    old_state = appointment.estado
    appointment.estado = AgendaCita.Estado.ANULADA
    appointment.motivo_anulacion = data.get("motivo", "")
    appointment.save(
        update_fields=["estado", "motivo_anulacion", "updated_at"]
    )
    reservation.version += 1
    reservation.ultima_gestion_at = timezone.now()
    reservation.save(update_fields=["version", "ultima_gestion_at"])
    event = AgendaReservaEvento.objects.create(
        reserva=reservation,
        tipo=AgendaReservaEvento.Tipo.CANCELADA,
        actor=AgendaReservaEvento.Actor.PACIENTE,
        inicio_anterior=appointment.inicio,
        fin_anterior=appointment.fin,
        estado_anterior=old_state,
        estado_nuevo=appointment.estado,
        motivo=data.get("motivo", ""),
        version=reservation.version,
        ip_hash=request_ip_hash(request),
        user_agent=(request.META.get("HTTP_USER_AGENT", ""))[:300],
        request_id=data["request_id"],
    )
    reservation.cita = appointment
    _schedule_side_effects(event)
    return reservation_payload(reservation)
