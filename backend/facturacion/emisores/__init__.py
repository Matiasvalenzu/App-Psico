from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .base import (  # noqa: F401
    DatosBoleta,
    EmisorBHE,
    ErrorAntesDeEnviar,
    ErrorCredencial,
    ErrorDespuesDeEnviar,
    ErrorEmisor,
    ErrorNegocio,
    LineaBoleta,
    Receptor,
    ResultadoEmision,
    Retencion,
)


def get_emisor():
    backend = settings.BHE_BACKEND
    if backend == "fake":
        from .fake import FakeEmisor

        return FakeEmisor()
    if backend == "playwright":
        raise ImproperlyConfigured("El emisor playwright todavía no está implementado.")
    raise ImproperlyConfigured("BHE_BACKEND no está configurado.")
