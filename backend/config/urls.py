from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    create_user,
    current_user,
    list_users,
    change_user_password,
    google_login,
    register_user,
    verify_registration,
    resend_registration_code_view,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/google/login/", google_login, name="google_login"),
    path("api/auth/register/", register_user, name="register_user"),
    path("api/auth/register/verify/", verify_registration, name="verify_registration"),
    path("api/auth/register/resend/", resend_registration_code_view, name="resend_registration_code"),
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
    path("api/feedback/", include("feedback.urls")),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

