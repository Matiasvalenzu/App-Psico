from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatConversacionViewSet

router = DefaultRouter()
router.register(r"", ChatConversacionViewSet, basename="chat-conversacion")

urlpatterns = [
    path("", include(router.urls)),
]
