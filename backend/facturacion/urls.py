from django.http import Http404
from django.urls import include, path
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView

from .envio import abrir_pdf
from .views import CobroViewSet, DelegacionView, descarga_privada

router = DefaultRouter()
router.register(r"cobros", CobroViewSet, basename="cobro")


@method_decorator(ratelimit(key="ip", rate="30/m", method="GET", block=True), name="get")
class BoletaPublicaView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        emision = abrir_pdf(token)
        if not emision:
            raise Http404
        return descarga_privada(emision.pdf.storage, emision.pdf.name)


urlpatterns = [
    path("delegacion/", DelegacionView.as_view(), name="delegacion-sii"),
    path("boletas/<path:token>/", BoletaPublicaView.as_view(), name="boleta-publica"),
    path("", include(router.urls)),
]
