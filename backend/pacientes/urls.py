from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .importar_views import (
    AnalizarImportacionView,
    ConfirmarImportacionView,
    DeshacerImportacionView,
    PlantillaImportacionView,
    PrevisualizarImportacionView,
    SugerirImportacionView,
)
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
    path("importar/plantilla/", PlantillaImportacionView.as_view(), name="pacientes-importar-plantilla"),
    path("importar/analizar/", AnalizarImportacionView.as_view(), name="pacientes-importar-analizar"),
    path("importar/sugerir/", SugerirImportacionView.as_view(), name="pacientes-importar-sugerir"),
    path("importar/previsualizar/", PrevisualizarImportacionView.as_view(), name="pacientes-importar-previsualizar"),
    path("importar/confirmar/", ConfirmarImportacionView.as_view(), name="pacientes-importar-confirmar"),
    path("importar/<int:pk>/deshacer/", DeshacerImportacionView.as_view(), name="pacientes-importar-deshacer"),
    path("<int:paciente_id>/consentimiento/", PacienteConsentimientoView.as_view(), name="paciente-consentimiento"),
    path("consentimiento/<int:pk>/enviar/", ReenviarConsentimientoView.as_view(), name="consentimiento-reenviar"),
    path("consentimiento/publico/<str:token>/", PublicConsentimientoView.as_view(), name="consentimiento-publico"),
    path("consentimiento/publico/<str:token>/firmar/", PublicFirmarConsentimientoView.as_view(), name="consentimiento-publico-firmar"),
    path("", include(router.urls)),
]

