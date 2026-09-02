from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import create_user, current_user, list_users, change_user_password, google_login

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/google/login/", google_login, name="google_login"),
    path("api/auth/me/", current_user, name="current_user"),
    path("api/auth/users/", create_user, name="create_user"),
    path("api/auth/users/<int:user_id>/password/", change_user_password, name="change_user_password"),
    path("api/auth/users/list/", list_users, name="list_users"),
    path("api/pacientes/", include("pacientes.urls")),
    path("api/sesiones/", include("sesiones.urls")),
    path("api/voz/", include("voz.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/evaluaciones/", include("evaluaciones.urls")),
    path("api/agenda/", include("agenda.urls")),
    path("api/suscripciones/", include("suscripciones.urls")),
    path("api/cuenta/", include("cuentas.urls")),
]
