from django.urls import path

from .views import (
    CatalogoEvaluacionDetalleView,
    CatalogoEvaluacionesView,
    EvaluacionAsignadaDetailView,
    EvaluacionAsignadaListCreateView,
    EvaluacionPublicaResponderView,
    EvaluacionPublicaView,
    ObservacionIAView,
)

urlpatterns = [
    path("catalogo/", CatalogoEvaluacionesView.as_view(), name="evaluaciones-catalogo"),
    path("catalogo/<slug:slug>/", CatalogoEvaluacionDetalleView.as_view(), name="evaluaciones-catalogo-detalle"),
    path("asignaciones/", EvaluacionAsignadaListCreateView.as_view(), name="evaluaciones-asignaciones"),
    path("asignaciones/<int:pk>/", EvaluacionAsignadaDetailView.as_view(), name="evaluaciones-asignacion-detalle"),
    path("resultados/<int:pk>/observacion-ia/", ObservacionIAView.as_view(), name="evaluaciones-observacion-ia"),
    path("publicas/<str:token>/", EvaluacionPublicaView.as_view(), name="evaluaciones-publica"),
    path("publicas/<str:token>/responder/", EvaluacionPublicaResponderView.as_view(), name="evaluaciones-publica-responder"),
]
