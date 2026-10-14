import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from django.utils import timezone

from rest_framework import serializers

# Tasa de retención de boletas de honorarios por año (Ley 21.133).
# La ley fija 17 % desde 2028 en adelante: actualizar esta tabla antes del 1-ene-2029.
TASAS_RETENCION_BHE = {
    2026: Decimal("15.25"),
    2027: Decimal("16.00"),
    2028: Decimal("17.00"),
}

# La glosa queda en un documento tributario: no debe revelar diagnósticos.
# Las siglas llevan espacios para no calzar dentro de otras palabras ("protocolo").
TERMINOS_CLINICOS = (
    "trastorno", "depresi", "ansiedad", "ansioso", "bipolar", "esquizofren", "psicosis",
    "psicótic", "estrés postraum", "autis", "anorexia", "bulimia", "suicid", "autolesi",
    "adicci", "diagnóstic", "cie-10", "cie10", " tept ", " toc ", " tdah ", " tea ", " dsm",
)
CODIGO_CIE = re.compile(r"\b[A-Z]\d{2}(\.\d{1,2})?\b", re.IGNORECASE)


def calcular_retencion(monto_bruto, fecha_pago):
    tasa = TASAS_RETENCION_BHE.get(fecha_pago.year)
    if tasa is None:
        raise serializers.ValidationError(
            {"fecha_pago": f"No hay tasa de retención cargada para {fecha_pago.year}."}
        )
    retencion = (Decimal(monto_bruto) * tasa / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return tasa, int(retencion), monto_bruto - int(retencion)


def anulable_hasta(fecha_emision):
    """La anulación simple en el portal del SII vale hasta el día 10 del mes siguiente."""
    if fecha_emision.month == 12:
        return date(fecha_emision.year + 1, 1, 10)
    return date(fecha_emision.year, fecha_emision.month + 1, 10)


# Los plazos del SII van en hora de Chile: el día 10 a las 23:00 todavía se anula, aunque en UTC ya sea el 11.
HORA_CHILE = ZoneInfo("America/Santiago")


def hoy_chile():
    return timezone.localdate(timezone=HORA_CHILE)


def plazo_anulacion_vencido(fecha_emision):
    return hoy_chile() > anulable_hasta(fecha_emision)


GLOSA_SII_MAX = 100
_SUFIJO_SESION = re.compile(r", sesiones?\b.+$", re.IGNORECASE)


def quitar_sufijo_sesion(glosa):
    return _SUFIJO_SESION.sub("", glosa or "").strip()


def componer_glosa_sesiones(base, sesiones):
    """Arma la glosa con número y fecha. No recorta: si no cabe en el SII, rechaza."""
    texto = quitar_sufijo_sesion(base) or "Atención psicológica"
    ordenadas = sorted(sesiones, key=lambda s: (s.numero_sesion or 0, s.fecha_hora_inicio, s.pk or 0))
    if not ordenadas:
        raise serializers.ValidationError(
            {"sesiones": "Elige al menos una sesión para incluirla en la glosa."}
        )
    partes = []
    for sesion in ordenadas:
        fecha = timezone.localtime(sesion.fecha_hora_inicio).strftime("%d/%m/%Y")
        if len(ordenadas) == 1:
            numero = sesion.numero_sesion or "—"
            partes.append(f"sesión {numero}, {fecha}")
        else:
            numero = sesion.numero_sesion or fecha
            partes.append(f"{numero} ({fecha})" if sesion.numero_sesion else fecha)
    if len(ordenadas) == 1:
        compuesta = f"{texto}, {partes[0]}"
    else:
        compuesta = f"{texto}, sesiones {', '.join(partes)}"
    if len(compuesta) > GLOSA_SII_MAX:
        raise serializers.ValidationError(
            {
                "glosa": (
                    "Con el número y la fecha de las sesiones, la glosa supera los "
                    f"{GLOSA_SII_MAX} caracteres del SII. Quita alguna sesión o acorta la glosa."
                )
            }
        )
    return validar_glosa(compuesta)


def validar_glosa(glosa):
    glosa = (glosa or "").strip()
    if not glosa:
        raise serializers.ValidationError("La glosa es obligatoria.")
    texto = f" {re.sub(r'[^\w-]+', ' ', glosa.lower())} "
    if any(termino in texto for termino in TERMINOS_CLINICOS) or CODIGO_CIE.search(glosa):
        raise serializers.ValidationError(
            "La glosa no puede incluir diagnósticos ni códigos clínicos. Usa algo como \"Atención psicológica\"."
        )
    return glosa


def enmascarar_rut(rut):
    """'777819771' -> '77.***.***-1'. Para admin y logs; nunca muestra el RUT completo."""
    limpio = "".join(c for c in (rut or "") if c.isalnum())
    if len(limpio) < 2:
        return "***"
    return f"{limpio[:-1][:-6] or '*'}.***.***-{limpio[-1].upper()}"
