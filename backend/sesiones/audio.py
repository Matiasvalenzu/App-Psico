"""Borrado de archivos de audio de sesiones.

El audio es efímero: se elimina apenas la transcripción termina, al borrar la
sesión, el paciente o la cuenta. Ningún error de borrado debe romper el flujo.
"""
import logging
import os
import shutil

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONES = (".webm", ".wav", ".mp3", ".m4a", ".ogg")
AUDIO_SUFIJOS = (
    "_stereo.webm",
    "_psicologo.webm",
    "_paciente.webm",
    "_split_psicologo.wav",
    "_split_paciente.wav",
)


def carpeta_audio_paciente(paciente_id):
    return os.path.join(settings.AUDIO_STORAGE_PATH, str(paciente_id))


def rutas_audio_sesion(sesion):
    carpeta = carpeta_audio_paciente(sesion.paciente_id)
    rutas = [os.path.join(carpeta, f"{sesion.id}{ext}") for ext in AUDIO_EXTENSIONES]
    rutas += [os.path.join(carpeta, f"{sesion.id}{sufijo}") for sufijo in AUDIO_SUFIJOS]
    if sesion.audio_path and sesion.audio_path not in rutas:
        rutas.append(sesion.audio_path)
    return rutas


def borrar_archivos_audio(sesion):
    """Elimina del disco todos los archivos de audio de la sesión. Devuelve cuántos borró."""
    borrados = 0
    for ruta in rutas_audio_sesion(sesion):
        try:
            os.remove(ruta)
            borrados += 1
        except FileNotFoundError:
            pass
        except OSError:
            logger.exception("No se pudo borrar el audio %s", ruta)
    return borrados


def borrar_audio_sesion(sesion):
    """Borra los archivos y deja constancia en la sesión."""
    borrar_archivos_audio(sesion)
    if sesion.audio_path and sesion.audio_eliminado_en is None:
        sesion.audio_eliminado_en = timezone.now()
        sesion.save(update_fields=["audio_eliminado_en", "updated_at"])


def borrar_carpeta_paciente(paciente_id):
    shutil.rmtree(carpeta_audio_paciente(paciente_id), ignore_errors=True)


def purgar_audios(dry_run=False):
    """Recorre AUDIO_STORAGE_PATH y borra todo audio que ya no deba existir.

    Se conserva solo el audio de sesiones aún no completadas y con actividad
    dentro de AUDIO_RETENCION_ERROR_DIAS (para poder reintentar). El resto
    (sesiones completadas, fallidas antiguas o inexistentes) se elimina.
    Devuelve (archivos, bytes).
    """
    from datetime import timedelta

    from .models import Sesion

    raiz = settings.AUDIO_STORAGE_PATH
    if not os.path.isdir(raiz):
        return 0, 0
    limite = timezone.now() - timedelta(days=settings.AUDIO_RETENCION_ERROR_DIAS)
    archivos = 0
    total_bytes = 0
    sesiones_purgadas = set()
    for carpeta, _subdirs, nombres in os.walk(raiz):
        for nombre in nombres:
            prefijo = nombre.split("_", 1)[0].split(".", 1)[0]
            if not prefijo.isdigit():
                continue
            ruta = os.path.join(carpeta, nombre)
            sesion = Sesion.objects.filter(pk=int(prefijo)).first()
            conservar = (
                sesion is not None
                and sesion.audio_eliminado_en is None
                and sesion.estado != Sesion.Estado.COMPLETADO
                and (
                    sesion.updated_at >= limite
                    or os.path.getmtime(ruta) >= limite.timestamp()
                )
            )
            if conservar:
                continue
            try:
                tamano = os.path.getsize(ruta)
                if not dry_run:
                    os.remove(ruta)
            except OSError:
                logger.exception("No se pudo purgar el audio %s", ruta)
                continue
            archivos += 1
            total_bytes += tamano
            if sesion is not None:
                sesiones_purgadas.add(sesion.pk)
        if not dry_run and carpeta != raiz and not os.listdir(carpeta):
            try:
                os.rmdir(carpeta)
            except OSError:
                pass
    if not dry_run and sesiones_purgadas:
        Sesion.objects.filter(
            pk__in=sesiones_purgadas, audio_eliminado_en__isnull=True
        ).exclude(audio_path="").update(audio_eliminado_en=timezone.now())
    return archivos, total_bytes
