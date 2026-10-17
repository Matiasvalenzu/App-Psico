from django.utils import timezone

from voz.services import get_audio_duration_seconds

from .models import Sesion


def es_videollamada_psiconex(sesion):
    return bool(sesion.token_sala) or sesion.plataforma_virtual == Sesion.Plataforma.PSICONEX


def registrar_inicio_videollamada(sesion):
    fields = []
    if sesion.estado_videollamada != Sesion.EstadoVideollamada.EN_CURSO:
        sesion.estado_videollamada = Sesion.EstadoVideollamada.EN_CURSO
        fields.append("estado_videollamada")
    if sesion.videollamada_inicio is None:
        sesion.videollamada_inicio = timezone.now()
        fields.append("videollamada_inicio")
    return fields


def _entero_positivo(value):
    try:
        segundos = int(value)
    except (TypeError, ValueError):
        return None
    return segundos if segundos > 0 else None


def _duracion_audio(audio_path):
    if not audio_path:
        return None
    try:
        return _entero_positivo(get_audio_duration_seconds(audio_path))
    except Exception:
        return None


def calcular_duracion_segundos(sesion, audio_path=None, informada=None):
    probe = _duracion_audio(audio_path)
    if probe:
        return probe
    informada = _entero_positivo(informada)
    if informada:
        return informada
    if sesion.videollamada_inicio:
        segundos = int((timezone.now() - sesion.videollamada_inicio).total_seconds())
        if segundos > 0:
            return segundos
    return None


def marcar_finalizada_si_corresponde(sesion, audio_path=None, informada=None):
    fields = []
    if (
        es_videollamada_psiconex(sesion)
        and sesion.estado_videollamada != Sesion.EstadoVideollamada.FINALIZADA
    ):
        sesion.estado_videollamada = Sesion.EstadoVideollamada.FINALIZADA
        fields.append("estado_videollamada")
    if not sesion.duracion_segundos:
        duracion = calcular_duracion_segundos(sesion, audio_path, informada)
        if duracion:
            sesion.duracion_segundos = duracion
            fields.append("duracion_segundos")
    return fields
