from django.urls import path

from .admin_views import (
    admin_embudo,
    admin_ingresos,
    admin_resumen,
    admin_uso,
    admin_usuario_detalle,
    admin_usuarios,
    admin_usuarios_export,
)
from .views import (
    actividad_view,
    eliminar_cuenta_view,
    exportar_cuenta_view,
    profile_detail,
    verify_notification_email_view,
)


urlpatterns = [
    path("admin/resumen/", admin_resumen, name="admin-resumen"),
    path("admin/usuarios/export/", admin_usuarios_export, name="admin-usuarios-export"),
    path("admin/usuarios/<int:user_id>/", admin_usuario_detalle, name="admin-usuario-detalle"),
    path("admin/usuarios/", admin_usuarios, name="admin-usuarios"),
    path("admin/ingresos/", admin_ingresos, name="admin-ingresos"),
    path("admin/uso/", admin_uso, name="admin-uso"),
    path("admin/embudo/", admin_embudo, name="admin-embudo"),
    path("perfil/", profile_detail, name="cuenta-perfil"),
    path(
        "perfil/verificar-email/",
        verify_notification_email_view,
        name="cuenta-verificar-email",
    ),
    path("eliminar/", eliminar_cuenta_view, name="cuenta-eliminar"),
    path("exportar/", exportar_cuenta_view, name="cuenta-exportar"),
    path("actividad/", actividad_view, name="cuenta-actividad"),
]
