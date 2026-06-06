from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AgendaCitaViewSet


router = DefaultRouter()
router.register(r"citas", AgendaCitaViewSet, basename="agenda-cita")

urlpatterns = [
    path("", include(router.urls)),
]
