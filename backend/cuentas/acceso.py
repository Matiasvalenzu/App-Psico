"""Registro de accesos a datos clínicos. Nunca interrumpe la acción registrada."""
import logging
from datetime import timedelta

from django.utils import timezone

from .models import RegistroAcceso

logger = logging.getLogger(__name__)

# Repetir la misma acción sobre el mismo objeto dentro de esta ventana no genera otra fila.
VENTANA_DUPLICADOS = timedelta(minutes=5)
RETENCION = timedelta(days=365)


def _ip(request):
    reenviada = request.META.get("HTTP_X_FORWARDED_FOR")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR") or None


def registrar_acceso(request, accion, paciente=None, objeto=""):
    try:
        objeto = str(objeto)[:120]
        reciente = RegistroAcceso.objects.filter(
            usuario=request.user,
            accion=accion,
            objeto=objeto,
            fecha__gte=timezone.now() - VENTANA_DUPLICADOS,
        )
        if reciente.exists():
            return
        RegistroAcceso.objects.create(
            usuario=request.user,
            paciente=paciente,
            accion=accion,
            objeto=objeto,
            ip=_ip(request),
        )
    except Exception:
        logger.exception("No se pudo registrar el acceso %s", accion)


def purgar_registros_antiguos():
    borrados, _ = RegistroAcceso.objects.filter(fecha__lt=timezone.now() - RETENCION).delete()
    return borrados
