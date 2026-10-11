"""Seudonimización del texto que se envía a proveedores de IA externos.

Reemplaza nombre y apellidos del paciente (y de su tutor o contacto de
emergencia) por marcadores, sin distinguir mayúsculas ni tildes.
"""
import re
import unicodedata

_VARIANTES = {
    "a": "aáàäâ",
    "e": "eéèëê",
    "i": "iíìïî",
    "o": "oóòöô",
    "u": "uúùüû",
    "n": "nñ",
}


def _sin_tildes(texto):
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in texto if not unicodedata.combining(c)).lower()


def _patron(palabra):
    partes = []
    for char in _sin_tildes(palabra):
        variantes = _VARIANTES.get(char)
        partes.append(f"[{variantes}]" if variantes else re.escape(char))
    return "".join(partes)


def _reemplazos(paciente):
    grupos = [
        ("[Paciente]", f"{paciente.nombre} {paciente.apellido}"),
        ("[Tutor]", getattr(paciente, "nombre_tutor", "")),
        ("[Contacto]", getattr(paciente, "contacto_emergencia_nombre", "")),
    ]
    reemplazos = []
    for marcador, nombre in grupos:
        # Palabras de 3+ letras para no tocar "de", "la", etc.
        palabras = [p for p in re.split(r"[\s\-]+", nombre or "") if len(p) >= 3]
        palabras.sort(key=len, reverse=True)
        reemplazos += [(marcador, p) for p in palabras]
    return reemplazos


def seudonimizar(texto, paciente):
    if not texto:
        return texto
    for marcador, palabra in _reemplazos(paciente):
        texto = re.sub(rf"\b{_patron(palabra)}\b", marcador, texto, flags=re.IGNORECASE)
    # "[Paciente] [Paciente]" (nombre + apellido) queda como un solo marcador.
    return re.sub(r"(\[(?:Paciente|Tutor|Contacto)\])(?:\s+\1)+", r"\1", texto)
