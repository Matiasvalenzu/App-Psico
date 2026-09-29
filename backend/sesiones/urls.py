from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SalaPublicaView, SesionViewSet

router = DefaultRouter()
router.register(r"", SesionViewSet, basename="sesion")

urlpatterns = [
    path("sala/<str:token>/", SalaPublicaView.as_view(), name="sala-publica"),
    path("", include(router.urls)),
]
