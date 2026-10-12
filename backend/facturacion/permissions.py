from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission


class TienePlanPlus(BasePermission):
    """Leer cobros siempre se puede; crearlos o modificarlos requiere el Plan Plus."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        suscripcion = getattr(user, "suscripcion", None)
        if user.is_staff or user.is_superuser or (suscripcion and suscripcion.tiene_boletas):
            return True
        raise PermissionDenied(
            {"detail": "Las boletas de honorarios están disponibles en el Plan Plus.", "code": "plan_required"}
        )
