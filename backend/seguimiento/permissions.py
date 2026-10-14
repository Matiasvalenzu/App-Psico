from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


class TienePlanPlusIA(BasePermission):
    """Brief previo a la sesión e informes para terceros: solo Plan Plus (mismo criterio que boletas)."""

    def has_permission(self, request, view):
        user = request.user
        suscripcion = getattr(user, "suscripcion", None)
        if user.is_staff or user.is_superuser or (suscripcion and suscripcion.tiene_boletas):
            return True
        raise PermissionDenied(
            {"detail": "El brief previo a la sesión y los informes con IA están disponibles en el Plan Plus.", "code": "requiere_plus"}
        )
