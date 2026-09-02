from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AgendaCitaViewSet,
    DisponibilidadViewSet,
    google_calendar_callback,
    google_calendar_connect,
    google_calendar_disconnect,
    google_calendar_status,
    google_calendar_sync,
    perfil_publico,
    perfil_publico_interno,
    cancelar_reserva_publica,
    confirmar_otp_reserva,
    identificar_reserva,
    reprogramar_reserva,
    reservar,
    solicitar_otp_reserva,
    slots_gestion_reserva,
    slots_disponibles,
)


router = DefaultRouter()
router.register(r"citas", AgendaCitaViewSet, basename="agenda-cita")
router.register(r"disponibilidad", DisponibilidadViewSet, basename="agenda-disponibilidad")

urlpatterns = [
    # Google Calendar (autenticado)
    path("google/status/", google_calendar_status, name="agenda-google-status"),
    path("google/connect/", google_calendar_connect, name="agenda-google-connect"),
    path("google/callback/", google_calendar_callback, name="agenda-google-callback"),
    path("google/sync/", google_calendar_sync, name="agenda-google-sync"),
    path("google/disconnect/", google_calendar_disconnect, name="agenda-google-disconnect"),
    # Perfil público interno (autenticado)
    path("perfil-publico/", perfil_publico_interno, name="agenda-perfil-publico-interno"),
    # Endpoints públicos (AllowAny)
    path("publica/<slug:slug>/", perfil_publico, name="agenda-perfil-publico"),
    path("publica/<slug:slug>/solicitar-otp/", solicitar_otp_reserva, name="agenda-solicitar-otp"),
    path("publica/<slug:slug>/confirmar-otp/", confirmar_otp_reserva, name="agenda-confirmar-otp"),
    path("publica/<slug:slug>/slots/", slots_disponibles, name="agenda-slots"),
    path("publica/<slug:slug>/reservar/", reservar, name="agenda-reservar"),
    path("publica/<slug:slug>/gestion/identificar/", identificar_reserva, name="agenda-identificar-reserva"),
    path("publica/<slug:slug>/gestion/slots/", slots_gestion_reserva, name="agenda-slots-gestion"),
    path("publica/<slug:slug>/gestion/reprogramar/", reprogramar_reserva, name="agenda-reprogramar-reserva"),
    path("publica/<slug:slug>/gestion/cancelar/", cancelar_reserva_publica, name="agenda-cancelar-reserva"),
    # Router (citas + disponibilidad)
    path("", include(router.urls)),
]
