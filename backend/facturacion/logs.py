"""Oculta en los logs la clave de la cuenta autorizada y los RUT.

Se aplica al crear cada registro (no en un handler), así ningún handler de Django ni de Celery
alcanza a ver el texto original, tampoco el de las excepciones.
"""

import logging
import re

from django.conf import settings

from .services import enmascarar_rut

RUT_RE = re.compile(r"\b(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dkK](?![\w])")


def ocultar(texto):
    clave = settings.BHE_SII_CLAVE
    if clave:
        texto = texto.replace(clave, "[CLAVE]")
    return RUT_RE.sub(lambda m: enmascarar_rut(m.group()), texto)


def _limpiar(record):
    try:
        mensaje = record.getMessage()
    except Exception:
        # Argumentos mal formados: que logging informe el error como siempre.
        return record
    record.msg, record.args = ocultar(mensaje), ()
    if record.exc_info:
        record.exc_text = ocultar(logging.Formatter().formatException(record.exc_info))
    return record


def instalar():
    original = logging.getLogRecordFactory()
    if getattr(original, "oculta_datos_sensibles", False):
        return

    def fabrica(*args, **kwargs):
        return _limpiar(original(*args, **kwargs))

    fabrica.oculta_datos_sensibles = True
    logging.setLogRecordFactory(fabrica)
