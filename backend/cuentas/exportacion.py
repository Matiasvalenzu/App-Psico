"""Exportación completa de los datos del profesional en un ZIP (JSON + PDF)."""
import json
import re
import tempfile
import zipfile

from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from pgvector.django import VectorField

from chat.exportes import pdf_informe
from sesiones.exportes import pdf_sesion

# Secretos y datos técnicos que no aportan al profesional.
CAMPOS_EXCLUIDOS = {"token_hash", "ip_hash", "codigo_hash", "access_token", "refresh_token"}


def _fila(obj):
    if obj is None:
        return None
    return {
        campo.attname: campo.value_from_object(obj)
        for campo in obj._meta.concrete_fields
        if not isinstance(campo, VectorField) and campo.name not in CAMPOS_EXCLUIDOS
    }


def _json(datos):
    return json.dumps(datos, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)


def _slug(texto):
    return re.sub(r"[^A-Za-z0-9_-]+", "-", texto.strip().lower()).strip("-")


def carpeta_paciente(paciente):
    return f"{_slug(f'{paciente.apellido} {paciente.nombre}') or 'paciente'}-{paciente.id}"


def _agregar_paciente(zf, paciente, carpeta):
    sesiones = list(paciente.sesiones.prefetch_related("segmentos").order_by("fecha_hora_inicio"))
    informes = list(paciente.informes_ia.select_related("paciente"))
    evaluaciones = paciente.evaluaciones_asignadas.select_related("resultado")
    conversaciones = paciente.conversaciones.prefetch_related("mensajes")
    datos = {
        "paciente": _fila(paciente),
        "consentimientos": [_fila(c) for c in paciente.consentimientos.all()],
        "sesiones": [
            {**_fila(s), "segmentos": [_fila(g) for g in s.segmentos.all()]} for s in sesiones
        ],
        "evaluaciones": [
            {**_fila(e), "resultado": _fila(getattr(e, "resultado", None))} for e in evaluaciones
        ],
        "conversaciones_ia": [
            {**_fila(c), "mensajes": [_fila(m) for m in c.mensajes.all()]} for c in conversaciones
        ],
        "informes_ia": [_fila(i) for i in informes],
        "agenda": [_fila(c) for c in paciente.agenda_citas.all()],
    }
    zf.writestr(f"{carpeta}/datos.json", _json(datos))
    for sesion in sesiones:
        fecha = sesion.fecha_hora_inicio.strftime("%Y-%m-%d")
        zf.writestr(f"{carpeta}/sesiones/{fecha}-sesion-{sesion.id}.pdf", pdf_sesion(sesion))
    for informe in informes:
        zf.writestr(f"{carpeta}/informes/informe-{informe.id}.pdf", pdf_informe(informe))


def _nuevo_zip():
    archivo = tempfile.TemporaryFile()
    return archivo, zipfile.ZipFile(archivo, "w", zipfile.ZIP_DEFLATED)


def _cerrar(archivo, zf):
    zf.close()
    archivo.seek(0)
    return archivo


def exportar_paciente(paciente):
    """Devuelve un archivo temporal (abierto) con el ZIP de un paciente."""
    archivo, zf = _nuevo_zip()
    _agregar_paciente(zf, paciente, carpeta_paciente(paciente))
    return _cerrar(archivo, zf)


def exportar_cuenta(user):
    """Devuelve un archivo temporal (abierto) con el ZIP de toda la cuenta."""
    archivo, zf = _nuevo_zip()
    cuenta = {
        "exportado_en": timezone.now(),
        "usuario": {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "date_joined": user.date_joined,
        },
        "perfil": _fila(getattr(user, "perfil_psicologo", None)),
        "suscripcion": _fila(getattr(user, "suscripcion", None)),
        "agenda_perfil_publico": _fila(getattr(user, "agenda_perfil_publico", None)),
        "agenda_disponibilidad": [_fila(d) for d in user.agenda_disponibilidad.all()],
        "agenda_bloqueos": [_fila(b) for b in user.agenda_bloqueos.all()],
        "agenda_citas_sin_paciente": [
            _fila(c) for c in user.agenda_citas.filter(paciente__isnull=True)
        ],
    }
    zf.writestr("cuenta.json", _json(cuenta))
    for paciente in user.pacientes.all():
        _agregar_paciente(zf, paciente, f"pacientes/{carpeta_paciente(paciente)}")
    return _cerrar(archivo, zf)
