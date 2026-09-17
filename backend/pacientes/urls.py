from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PacienteViewSet,
    PacienteConsentimientoView,
    ReenviarConsentimientoView,
    PublicConsentimientoView,
    PublicFirmarConsentimientoView,
)

router = DefaultRouter()
router.register(r"", PacienteViewSet, basename="paciente")

urlpatterns = [
    path("<int:paciente_id>/consentimiento/", PacienteConsentimientoView.as_view(), name="paciente-consentimiento"),
    path("consentimiento/<int:pk>/enviar/", ReenviarConsentimientoView.as_view(), name="consentimiento-reenviar"),
    path("consentimiento/publico/<str:token>/", PublicConsentimientoView.as_view(), name="consentimiento-publico"),
    path("consentimiento/publico/<str:token>/firmar/", PublicFirmarConsentimientoView.as_view(), name="consentimiento-publico-firmar"),
    path("", include(router.urls)),
]

