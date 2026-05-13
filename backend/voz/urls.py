from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VoiceProfileViewSet

router = DefaultRouter()
router.register(r"", VoiceProfileViewSet, basename="voice-profile")

urlpatterns = [
    path("", include(router.urls)),
]
