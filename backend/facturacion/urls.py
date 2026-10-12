from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CobroViewSet, DelegacionView

router = DefaultRouter()
router.register(r"cobros", CobroViewSet, basename="cobro")

urlpatterns = [
    path("delegacion/", DelegacionView.as_view(), name="delegacion-sii"),
    path("", include(router.urls)),
]
