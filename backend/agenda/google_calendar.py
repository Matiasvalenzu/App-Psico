import secrets
from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from .models import (
    AgendaCita,
    AgendaGoogleCalendarConnection,
    AgendaGoogleOAuthState,
)


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
# Psiconex only manages the secondary calendar it creates. Calendar data must
# never be imported into clinical records or sent to external AI services.
GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.app.created"
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

    # Replace prior broad grants before requesting the isolated Calendar scope.
    disconnect_google_calendar(user)
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
    if not _has_required_scope(token_data.get("scope", "")):
        raise GoogleCalendarError("Google no otorgó el permiso requerido para el calendario dedicado.")

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
    requires_reauthorization = bool(
        connection and connection.connected and not _has_required_scope(connection.scope)
    )
    return {
        "configured": google_calendar_configured(),
        "connected": bool(connection and connection.connected and not requires_reauthorization),
        "requires_reauthorization": requires_reauthorization,
        "calendar_name": settings.GOOGLE_CALENDAR_NAME,
        "calendar_id": connection.calendar_id if connection else "",
        "last_synced_at": connection.last_synced_at if connection else None,
    }


def disconnect_google_calendar(user):
    connection = AgendaGoogleCalendarConnection.objects.filter(psicologo=user).first()
    if connection:
        _revoke_connection(connection)
    AgendaCita.objects.filter(psicologo=user).update(
        google_calendar_id="",
        google_event_id="",
        google_synced_at=None,
        google_sync_error="",
    )
    AgendaGoogleCalendarConnection.objects.filter(psicologo=user).delete()


def sync_cita_to_google(cita):
    connection = _get_active_connection(cita.psicologo)
    if not connection:
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


def sync_app_to_google(user):
    connection = _get_active_connection(user)
    if not connection:
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
    connection.last_synced_at = timezone.now()
    connection.save(update_fields=["last_synced_at", "updated_at"])
    return {"connected": True, "synced": synced, "failed": failed}


def ensure_dedicated_calendar(connection):
    if connection.calendar_id:
        return connection.calendar_id

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


def _has_required_scope(scope):
    return GOOGLE_SCOPE in (scope or "").split()


def _get_active_connection(user):
    connection = AgendaGoogleCalendarConnection.objects.filter(psicologo=user).first()
    if not connection or not connection.connected or not _has_required_scope(connection.scope):
        return None
    return connection


def _revoke_connection(connection):
    token = connection.refresh_token or connection.access_token
    if not token:
        return
    try:
        requests.post(GOOGLE_REVOKE_URL, data={"token": token}, timeout=10)
    except requests.RequestException:
        # Local credentials are deleted even if Google's revocation endpoint is unavailable.
        pass


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
