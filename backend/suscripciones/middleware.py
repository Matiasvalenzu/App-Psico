"""Solo lectura para cuentas con la suscripción inactiva.

Bloquea escrituras en la API del profesional; las lecturas y la exportación
siguen disponibles hasta la purga. Los endpoints públicos (pacientes) no
llevan token y no se ven afectados.
"""
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication

METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}
RUTAS_PERMITIDAS = (
    "/api/auth/",
    "/api/suscripciones/",
    "/api/cuenta/",
    "/api/feedback/",
)


def _usuario_jwt(request):
    try:
        resultado = JWTAuthentication().authenticate(request)
    except Exception:
        return None  # DRF responderá el 401 correspondiente.
    return resultado[0] if resultado else None


class SoloLecturaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/"):
            user = _usuario_jwt(request)
            if user is not None:
                try:
                    from cuentas.actividad import registrar_actividad

                    registrar_actividad(user)
                except Exception:
                    pass
        if (
            request.method not in METODOS_SEGUROS
            and request.path.startswith("/api/")
            and not request.path.startswith(RUTAS_PERMITIDAS)
        ):
            user = _usuario_jwt(request)
            if user and not (user.is_staff or user.is_superuser):
                suscripcion = getattr(user, "suscripcion", None)
                if suscripcion and not suscripcion.puede_escribir:
                    return JsonResponse(
                        {
                            "code": "subscription_inactive",
                            "detail": "Tu suscripción no está activa: la cuenta está en solo lectura. "
                            "Puedes ver y exportar tus datos, o reactivar tu plan.",
                            "fecha_purga": suscripcion.fecha_purga,
                        },
                        status=403,
                    )
        return self.get_response(request)
