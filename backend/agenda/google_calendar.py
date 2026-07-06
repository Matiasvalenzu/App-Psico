import secrets
from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.db import transaction
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import (
    AgendaCita,
    AgendaGoogleCalendarConnection,
    AgendaGoogleOAuthState,
)


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar"
SYNC_WINDOW_PAST_DAYS = 30
SYNC_WINDOW_FUTURE_DAYS = 365


class GoogleCalendarError(Exception):
    pass


def google_calendar_configured():
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def get_redirect_uri(request):
    if settings.GOOGLE_CALENDAR_REDIRECT_URI:
        return settings.GOOGLE_CALENDAR_REDIRECT_URI
    return request.build_absolute_uri(reverse("agenda-google-callback"))


def build_authorization_url(user, redirect_uri):
    if not google_calendar_configured():
        raise GoogleCalendarError("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.")

    state = secrets.token_urlsafe(32)
    AgendaGoogleOAuthState.objects.create(
        psicologo=user,
        state=state,
        redirect_uri=redirect_uri,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def complete_oauth_callback(code, state):
    try:
        oauth_state = AgendaGoogleOAuthState.objects.select_related("psicologo").get(
            state=state
        )
    except AgendaGoogleOAuthState.DoesNotExist as exc:
        raise GoogleCalendarError("La autorización de Google expiró o no es válida.") from exc

    if oauth_state.is_expired():
        oauth_state.delete()
        raise GoogleCalendarError("La autorización de Google expiró. Intenta conectar nuevamente.")

    token_data = _exchange_code_for_tokens(code, oauth_state.redirect_uri)
    connection, _ = AgendaGoogleCalendarConnection.objects.get_or_create(
        psicologo=oauth_state.psicologo,
        defaults={"calendar_name": settings.GOOGLE_CALENDAR_NAME},
    )
    connection.calendar_name = settings.GOOGLE_CALENDAR_NAME
    connection.access_token = token_data.get("access_token", "")
    if token_data.get("refresh_token"):
        connection.refresh_token = token_data["refresh_token"]
    connection.scope = token_data.get("scope", "")
    connection.token_expires_at = _expires_at(token_data.get("expires_in"))
    connection.save()
    ensure_dedicated_calendar(connection)
    oauth_state.delete()
    return connection


def get_connection_status(user):
    connection = AgendaGoogleCalendarConnection.objects.filter(psicologo=user).first()
    return {
        "configured": google_calendar_configured(),
        "connected": bool(connection and connection.connected),
        "calendar_name": settings.GOOGLE_CALENDAR_NAME,
        "calendar_id": connection.calendar_id if connection else "",
        "last_synced_at": connection.last_synced_at if connection else None,
    }


def disconnect_google_calendar(user):
    AgendaGoogleCalendarConnection.objects.filter(psicologo=user).delete()


def sync_cita_to_google(cita):
    connection = AgendaGoogleCalendarConnection.objects.filter(
        psicologo=cita.psicologo
    ).first()
    if not connection or not connection.connected:
        return None

    try:
        calendar_id = ensure_dedicated_calendar(connection)
        if cita.estado == AgendaCita.Estado.ANULADA:
            if cita.google_event_id:
                _google_request(
                    connection,
                    "DELETE",
                    f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events/{cita.google_event_id}",
                    allow_not_found=True,
                )
            cita.google_calendar_id = calendar_id
            cita.google_synced_at = timezone.now()
            cita.google_sync_error = ""
            cita.save(update_fields=["google_calendar_id", "google_synced_at", "google_sync_error", "updated_at"])
            return {"deleted": True}

        body = _event_body(cita)
        if cita.google_event_id:
            try:
                event = _google_request(
                    connection,
                    "PUT",
                    f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events/{cita.google_event_id}",
                    json=body,
                )
            except GoogleCalendarError:
                event = _google_request(
                    connection,
                    "POST",
                    f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events",
                    json=body,
                )
        else:
            event = _google_request(
                connection,
                "POST",
                f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events",
                json=body,
            )

        cita.google_calendar_id = calendar_id
        cita.google_event_id = event.get("id", cita.google_event_id)
        cita.google_synced_at = timezone.now()
        cita.google_sync_error = ""
        cita.save(
            update_fields=[
                "google_calendar_id",
                "google_event_id",
                "google_synced_at",
                "google_sync_error",
                "updated_at",
            ]
        )
        return event
    except Exception as exc:
        cita.google_sync_error = str(exc)
        cita.save(update_fields=["google_sync_error", "updated_at"])
        return None


@transaction.atomic
def sync_google_to_app(user):
    connection = AgendaGoogleCalendarConnection.objects.filter(psicologo=user).first()
    if not connection or not connection.connected:
        return {"connected": False, "created": 0, "updated": 0, "cancelled": 0, "skipped": 0}

    calendar_id = ensure_dedicated_calendar(connection)
    now = timezone.now()
    params = {
        "singleEvents": "true",
        "showDeleted": "true",
        "orderBy": "startTime",
        "maxResults": "2500",
        "timeMin": (now - timedelta(days=SYNC_WINDOW_PAST_DAYS)).isoformat(),
        "timeMax": (now + timedelta(days=SYNC_WINDOW_FUTURE_DAYS)).isoformat(),
    }
    created = updated = cancelled = skipped = 0

    while True:
        data = _google_request(
            connection,
            "GET",
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events",
            params=params,
        )
        for event in data.get("items", []):
            result = _upsert_event_from_google(user, calendar_id, event)
            created += int(result == "created")
            updated += int(result == "updated")
            cancelled += int(result == "cancelled")
            skipped += int(result == "skipped")

        page_token = data.get("nextPageToken")
        if not page_token:
            break
        params["pageToken"] = page_token

    connection.last_synced_at = timezone.now()
    connection.save(update_fields=["last_synced_at", "updated_at"])
    return {
        "connected": True,
        "calendar_name": connection.calendar_name,
        "created": created,
        "updated": updated,
        "cancelled": cancelled,
        "skipped": skipped,
        "last_synced_at": connection.last_synced_at,
    }


def sync_app_to_google(user):
    connection = AgendaGoogleCalendarConnection.objects.filter(psicologo=user).first()
    if not connection or not connection.connected:
        return {"connected": False, "synced": 0, "failed": 0}

    now = timezone.now()
    citas = AgendaCita.objects.filter(
        psicologo=user,
        inicio__gte=now - timedelta(days=SYNC_WINDOW_PAST_DAYS),
        inicio__lte=now + timedelta(days=SYNC_WINDOW_FUTURE_DAYS),
    ).select_related("paciente", "psicologo")
    synced = failed = 0
    for cita in citas:
        sync_cita_to_google(cita)
        cita.refresh_from_db(fields=["google_sync_error"])
        if cita.google_sync_error:
            failed += 1
        else:
            synced += 1
    return {"connected": True, "synced": synced, "failed": failed}


def ensure_dedicated_calendar(connection):
    if connection.calendar_id:
        return connection.calendar_id

    page_token = None
    while True:
        params = {"maxResults": "250"}
        if page_token:
            params["pageToken"] = page_token
        data = _google_request(
            connection,
            "GET",
            f"{GOOGLE_CALENDAR_API}/users/me/calendarList",
            params=params,
        )
        for calendar in data.get("items", []):
            if calendar.get("summary") == connection.calendar_name:
                connection.calendar_id = calendar.get("id", "")
                connection.save(update_fields=["calendar_id", "updated_at"])
                return connection.calendar_id
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    calendar = _google_request(
        connection,
        "POST",
        f"{GOOGLE_CALENDAR_API}/calendars",
        json={"summary": connection.calendar_name, "timeZone": settings.TIME_ZONE},
    )
    connection.calendar_id = calendar["id"]
    connection.save(update_fields=["calendar_id", "updated_at"])
    return connection.calendar_id


def _exchange_code_for_tokens(code, redirect_uri):
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    if not response.ok:
        raise GoogleCalendarError("Google rechazó la autorización.")
    return response.json()


def _refresh_access_token(connection):
    if not connection.refresh_token:
        raise GoogleCalendarError("La conexión Google no tiene refresh token.")
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": connection.refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if not response.ok:
        try:
            data = response.json()
            if data.get("error") == "invalid_grant":
                connection.delete()
                raise GoogleCalendarError("La conexión con Google ha expirado o fue revocada. Por favor, vuelve a conectar tu cuenta.")
        except Exception:
            pass
        raise GoogleCalendarError("No se pudo renovar la conexión con Google Calendar.")
    data = response.json()
    connection.access_token = data.get("access_token", "")
    connection.token_expires_at = _expires_at(data.get("expires_in"))
    connection.save(update_fields=["access_token", "token_expires_at", "updated_at"])
    return connection.access_token


def _access_token(connection):
    if connection.access_token and connection.token_expires_at:
        if connection.token_expires_at > timezone.now() + timedelta(minutes=1):
            return connection.access_token
    return _refresh_access_token(connection)


def _google_request(connection, method, url, allow_not_found=False, **kwargs):
    token = _access_token(connection)
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {token}"
    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if response.status_code == 401:
        headers["Authorization"] = f"Bearer {_refresh_access_token(connection)}"
        response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if allow_not_found and response.status_code in (404, 410):
        return {}
    if not response.ok:
        raise GoogleCalendarError(response.text[:500] or "Error en Google Calendar.")
    if response.status_code == 204 or not response.content:
        return {}
    return response.json()


def _expires_at(expires_in):
    seconds = int(expires_in or 3600)
    return timezone.now() + timedelta(seconds=max(seconds - 60, 60))


def _event_body(cita):
    return {
        "summary": f"Sesión - {_contact_full_name(cita)}",
        "description": "Evento sincronizado desde Herramienta Psicólogo.",
        "start": {
            "dateTime": timezone.localtime(cita.inicio).isoformat(),
            "timeZone": settings.TIME_ZONE,
        },
        "end": {
            "dateTime": timezone.localtime(cita.fin).isoformat(),
            "timeZone": settings.TIME_ZONE,
        },
        "extendedProperties": {
            "private": {
                "herramienta_psicologo": "true",
                "herramienta_psicologo_cita_id": str(cita.id),
            }
        },
    }


def _contact_full_name(cita):
    if cita.paciente_id and cita.paciente:
        return cita.paciente.nombre_completo
    nombre = f"{cita.prospecto_nombre} {cita.prospecto_apellido}".strip()
    return nombre or "Paciente"


def _upsert_event_from_google(user, calendar_id, event):
    event_id = event.get("id", "")
    if not event_id:
        return "skipped"

    local = _find_local_cita(user, event)
    if event.get("status") == "cancelled":
        if local and local.estado != AgendaCita.Estado.ANULADA:
            local.estado = AgendaCita.Estado.ANULADA
            local.google_synced_at = timezone.now()
            local.save(update_fields=["estado", "google_synced_at", "updated_at"])
            return "cancelled"
        return "skipped"

    start, end = _event_times(event)
    if not start or not end:
        return "skipped"

    if _has_overlap(user, start, end, exclude_id=local.id if local else None):
        return "skipped"

    if local:
        local.inicio = start
        local.fin = end
        local.google_calendar_id = calendar_id
        local.google_event_id = event_id
        local.google_synced_at = timezone.now()
        local.google_sync_error = ""
        local.save(
            update_fields=[
                "inicio",
                "fin",
                "google_calendar_id",
                "google_event_id",
                "google_synced_at",
                "google_sync_error",
                "updated_at",
            ]
        )
        return "updated"

    nombre, apellido = _name_from_summary(event.get("summary", ""))
    AgendaCita.objects.create(
        psicologo=user,
        prospecto_nombre=nombre,
        prospecto_apellido=apellido,
        inicio=start,
        fin=end,
        notas="Importado desde Google Calendar.",
        google_calendar_id=calendar_id,
        google_event_id=event_id,
        google_synced_at=timezone.now(),
    )
    return "created"


def _find_local_cita(user, event):
    private = event.get("extendedProperties", {}).get("private", {})
    cita_id = private.get("herramienta_psicologo_cita_id")
    if cita_id:
        local = AgendaCita.objects.filter(id=cita_id, psicologo=user).first()
        if local:
            return local
    return AgendaCita.objects.filter(psicologo=user, google_event_id=event.get("id", "")).first()


def _event_times(event):
    start_value = event.get("start", {}).get("dateTime")
    end_value = event.get("end", {}).get("dateTime")
    if not start_value or not end_value:
        return None, None
    start = parse_datetime(start_value)
    end = parse_datetime(end_value)
    if start and timezone.is_naive(start):
        start = timezone.make_aware(start, timezone.get_current_timezone())
    if end and timezone.is_naive(end):
        end = timezone.make_aware(end, timezone.get_current_timezone())
    return start, end


def _name_from_summary(summary):
    cleaned = summary.strip() or "Posible paciente"
    if cleaned.lower().startswith("sesión -"):
        cleaned = cleaned.split("-", 1)[1].strip()
    parts = cleaned.split()
    if not parts:
        return "Posible", "Paciente"
    if len(parts) == 1:
        return parts[0], "Pendiente"
    return parts[0], " ".join(parts[1:])


def _has_overlap(user, inicio, fin, exclude_id=None):
    qs = AgendaCita.objects.filter(
        psicologo=user,
        inicio__lt=fin,
        fin__gt=inicio,
    ).exclude(estado=AgendaCita.Estado.ANULADA)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    return qs.exists()
