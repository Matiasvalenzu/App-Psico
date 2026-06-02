from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import create_user, current_user

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", current_user, name="current_user"),
    path("api/auth/users/", create_user, name="create_user"),
    path("api/pacientes/", include("pacientes.urls")),
    path("api/sesiones/", include("sesiones.urls")),
    path("api/voz/", include("voz.urls")),
    path("api/chat/", include("chat.urls")),
]
