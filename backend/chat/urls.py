from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatConversacionViewSet, InformeIAViewSet

router = DefaultRouter()
router.register(r"", ChatConversacionViewSet, basename="chat-conversacion")

informe_list = InformeIAViewSet.as_view({"get": "list", "post": "create"})
informe_detail = InformeIAViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
informe_pdf = InformeIAViewSet.as_view({"get": "exportar_pdf"})
informe_docx = InformeIAViewSet.as_view({"get": "exportar_docx"})

urlpatterns = [
    path("informes/", informe_list, name="informe-ia-list"),
    path("informes/<int:pk>/exportar_pdf/", informe_pdf, name="informe-ia-pdf"),
    path("informes/<int:pk>/exportar_docx/", informe_docx, name="informe-ia-docx"),
    path("informes/<int:pk>/", informe_detail, name="informe-ia-detail"),
    path("", include(router.urls)),
]
