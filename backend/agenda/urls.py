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
    reservar,
    slots_disponibles,
    verificar_paciente,
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
    path("publica/<slug:slug>/verificar-paciente/", verificar_paciente, name="agenda-verificar-paciente"),
    path("publica/<slug:slug>/slots/", slots_disponibles, name="agenda-slots"),
    path("publica/<slug:slug>/reservar/", reservar, name="agenda-reservar"),
    # Router (citas + disponibilidad)
    path("", include(router.urls)),
]
