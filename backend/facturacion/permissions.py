from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


class TienePlanPlus(BasePermission):
    """Cobros y boletas, también la lectura, requieren Plan Plus activo."""

    def has_permission(self, request, view):
        user = request.user
        suscripcion = getattr(user, "suscripcion", None)
        if user.is_staff or user.is_superuser or (suscripcion and suscripcion.tiene_boletas):
            return True
        raise PermissionDenied(
            {"detail": "Las boletas de honorarios están disponibles en el Plan Plus.", "code": "requiere_plus"}
        )
