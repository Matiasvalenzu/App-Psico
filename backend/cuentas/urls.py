from django.urls import path

from .views import eliminar_cuenta_view, profile_detail, verify_notification_email_view


urlpatterns = [
    path("perfil/", profile_detail, name="cuenta-perfil"),
    path(
        "perfil/verificar-email/",
        verify_notification_email_view,
        name="cuenta-verificar-email",
    ),
    path("eliminar/", eliminar_cuenta_view, name="cuenta-eliminar"),
]
