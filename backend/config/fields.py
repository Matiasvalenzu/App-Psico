"""Cifrado de campos sensibles en la base de datos con Fernet (AES-128-CBC + HMAC-SHA256).

Los valores se guardan como "enc:<token>". Un valor sin prefijo se lee tal cual,
para tolerar filas en claro mientras corre la migración. Al estar cifrados, estos
campos no sirven para filtrar ni ordenar.
"""
from functools import lru_cache

from cryptography.fernet import Fernet, MultiFernet
from django.conf import settings
from django.db import migrations, models

PREFIJO = "enc:"


@lru_cache(maxsize=1)
def _fernet():
    # La primera clave cifra; las demás solo descifran (rotación).
    return MultiFernet([Fernet(clave) for clave in settings.FIELD_ENCRYPTION_KEYS])


def cifrar(texto):
    if not texto or texto.startswith(PREFIJO):
        return texto
    return PREFIJO + _fernet().encrypt(texto.encode()).decode()


def descifrar(valor):
    if not valor or not valor.startswith(PREFIJO):
        return valor
    return _fernet().decrypt(valor[len(PREFIJO):].encode()).decode()


class EncryptedTextField(models.TextField):
    def from_db_value(self, value, expression, connection):
        return descifrar(value)

    def get_prep_value(self, value):
        return cifrar(super().get_prep_value(value))


def cifrar_existentes(app_label, model_name, campos):
    """RunPython reversible que cifra (o vuelve a dejar en claro) las filas existentes."""

    def cifrar_filas(apps, schema_editor):
        Modelo = apps.get_model(app_label, model_name)
        for obj in Modelo.objects.only("pk", *campos).iterator():
            obj.save(update_fields=campos)

    def descifrar_filas(apps, schema_editor):
        Modelo = apps.get_model(app_label, model_name)
        columnas = ", ".join(f'"{Modelo._meta.get_field(c).column}" = %s' for c in campos)
        sql = f'UPDATE "{Modelo._meta.db_table}" SET {columnas} WHERE "{Modelo._meta.pk.column}" = %s'
        with schema_editor.connection.cursor() as cursor:
            for obj in Modelo.objects.only("pk", *campos).iterator():
                cursor.execute(sql, [getattr(obj, c) for c in campos] + [obj.pk])

    return migrations.RunPython(cifrar_filas, descifrar_filas)
