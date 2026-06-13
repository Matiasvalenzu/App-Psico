from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AgendaCitaViewSet,
    google_calendar_callback,
    google_calendar_connect,
    google_calendar_disconnect,
    google_calendar_status,
    google_calendar_sync,
)


router = DefaultRouter()
router.register(r"citas", AgendaCitaViewSet, basename="agenda-cita")

urlpatterns = [
    path("google/status/", google_calendar_status, name="agenda-google-status"),
    path("google/connect/", google_calendar_connect, name="agenda-google-connect"),
    path("google/callback/", google_calendar_callback, name="agenda-google-callback"),
    path("google/sync/", google_calendar_sync, name="agenda-google-sync"),
    path("google/disconnect/", google_calendar_disconnect, name="agenda-google-disconnect"),
    path("", include(router.urls)),
]
