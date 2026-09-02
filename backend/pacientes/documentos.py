import re

from rest_framework import serializers


TIPO_RUT = "RUT"
TIPOS_DOCUMENTO = (
    (TIPO_RUT, "RUT chileno"),
    ("PASAPORTE", "Pasaporte"),
    ("OTRO", "Otro documento"),
)


def normalizar_documento(tipo, numero):
    tipo = (tipo or TIPO_RUT).strip().upper()
    numero = re.sub(r"[^0-9A-Z]", "", (numero or "").strip().upper())
    if tipo not in dict(TIPOS_DOCUMENTO):
        raise serializers.ValidationError("Tipo de documento inválido.")
    if not numero:
        raise serializers.ValidationError("El número de documento es obligatorio.")
    if tipo == TIPO_RUT:
        validar_rut(numero)
    elif len(numero) < 5 or len(numero) > 30:
        raise serializers.ValidationError("El documento debe tener entre 5 y 30 caracteres.")
    return numero


def validar_rut(rut):
    if len(rut) < 7 or len(rut) > 9 or not rut[:-1].isdigit():
        raise serializers.ValidationError("Ingresa un RUT válido.")
    cuerpo = rut[:-1]
    digito = rut[-1]
    suma = 0
    multiplicador = 2
    for caracter in reversed(cuerpo):
        suma += int(caracter) * multiplicador
        multiplicador = 2 if multiplicador == 7 else multiplicador + 1
    resultado = 11 - (suma % 11)
    esperado = "0" if resultado == 11 else "K" if resultado == 10 else str(resultado)
    if digito != esperado:
        raise serializers.ValidationError("El dígito verificador del RUT no es válido.")


def formatear_documento(tipo, numero):
    if tipo != TIPO_RUT or len(numero) < 2:
        return numero
    cuerpo, digito = numero[:-1], numero[-1]
    partes = []
    while cuerpo:
        partes.insert(0, cuerpo[-3:])
        cuerpo = cuerpo[:-3]
    return f"{'.'.join(partes)}-{digito}"
