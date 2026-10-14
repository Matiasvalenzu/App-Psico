from django.urls import path

from . import views as v

urlpatterns = [
    path("escalas/catalogo/", v.CatalogoEscalasView.as_view()),
    path("escalas/alertas/", v.AlertasPendientesView.as_view()),
    path("escalas/aplicaciones/<int:pk>/", v.AplicacionDetalleView.as_view()),
    path("escalas/aplicaciones/<int:pk>/cancelar/", v.CancelarAplicacionView.as_view()),
    path("escalas/aplicaciones/<int:pk>/revisar-alerta/", v.RevisarAlertaView.as_view()),
    path("escalas/publica/<str:token>/", v.EscalaPublicaView.as_view()),
    path("pacientes/<int:paciente_id>/escalas/", v.AplicacionesPacienteView.as_view()),
    path("pacientes/<int:paciente_id>/trayectoria/", v.TrayectoriaView.as_view()),
    path("cie10/", v.Cie10BuscarView.as_view()),
    path("pacientes/<int:paciente_id>/diagnostico/", v.DiagnosticoPacienteView.as_view()),
    path("pacientes/<int:paciente_id>/brief/", v.BriefView.as_view()),
    path("pacientes/<int:paciente_id>/informes/", v.InformesView.as_view()),
    path("documentos/<int:pk>/", v.DocumentoDetalleView.as_view()),
    path("documentos/<int:pk>/finalizar/", v.FinalizarDocumentoView.as_view()),
    path("documentos/<int:pk>/regenerar/", v.RegenerarDocumentoView.as_view()),
    path("documentos/<int:pk>/exportar/<str:formato>/", v.ExportarDocumentoView.as_view()),
    path("pacientes/<int:paciente_id>/tareas/", v.TareasPacienteView.as_view()),
    path("tareas/<int:pk>/", v.TareaDetalleView.as_view()),
    path("tareas/<int:pk>/completar/", v.CompletarTareaView.as_view()),
    path("pacientes/<int:paciente_id>/animo/", v.AnimoPacienteView.as_view()),
    path("animo/<int:pk>/", v.AnimoDetalleView.as_view()),
    path("pacientes/<int:paciente_id>/portal/", v.PortalPacienteView.as_view()),
    path("portal/<str:token>/", v.PortalPublicoView.as_view()),
    path("portal/<str:token>/tareas/<int:tarea_id>/completar/", v.PortalCompletarTareaView.as_view()),
    path("portal/<str:token>/animo/", v.PortalAnimoView.as_view()),
]
