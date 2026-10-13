import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

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
