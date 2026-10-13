"""Emisión automática de boletas como usuario autorizado (Fase 2).

Las vistas llaman a solicitar_*; el trabajo lo hace la cola `bhe` (tasks.py) con procesar y conciliar.
Reglas que no se deben romper:
- Antes de enviar al SII se guarda paso=ANTES_SUBMIT. Si después algo falla, la emisión queda
  DESCONOCIDO y solo se busca en el SII: nunca se vuelve a enviar sola.
- Lo que la búsqueda no resuelve queda para revisión manual, nunca FALLIDA.
- Un rechazo de la clave de la cuenta autorizada pausa toda la cola y no se reintenta.
Los mensajes de log usan solo ids: nada del receptor.
"""

import json
import logging
import re
import unicodedata
from dataclasses import asdict
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from pypdf import PdfReader

from .comunas import buscar_comuna
from .emisores import (
    DatosBoleta,
    ErrorAntesDeEnviar,
    ErrorCredencial,
    ErrorNegocio,
    LineaBoleta,
    Receptor,
    Retencion,
    get_emisor,
)
from .logs import ocultar
from .models import Cobro, ConfiguracionBHE, DelegacionSII, EmisionBHE
from .services import HORA_CHILE, anulable_hasta, hoy_chile

logger = logging.getLogger(__name__)

# Espera antes de cada reintento: 3 reintentos, 4 ejecuciones en total.
ESPERAS_REINTENTO = (60, 300, 900)
# Primera búsqueda a los 2 minutos; la segunda, 10 minutos después.
ESPERAS_BUSQUEDA = {1: 120, 2: 600}
LIMITE_EN_CURSO = timedelta(minutes=15)
# Las capturas del portal muestran la sesión de la cuenta de Psiconex: se borran a los 90 días.
RETENCION_EVIDENCIAS = timedelta(days=90)

ANTES_SUBMIT = "ANTES_SUBMIT"
REVISION_MANUAL = "REVISION_MANUAL"
# Versión del texto de consentimiento que acepta el psicólogo al autorizar a Psiconex.
# Borrador hasta que el abogado valide el texto final.
CONSENTIMIENTO_VERSION = "2026-10-borrador"

RETENCION_POR_MODO = {
    Cobro.ModoBoleta.RETENCION_POR_EMISOR: Retencion.CONTRIBUYENTE,
    Cobro.ModoBoleta.RECEPTOR_RETIENE: Retencion.RECEPTOR,
}

MENSAJES = {
    "plan_required": "Las boletas de honorarios están disponibles en el Plan Plus.",
    "bhe_no_disponible": "La emisión automática de boletas todavía no está disponible.",
    "delegacion_inactiva": "Psiconex no tiene una autorización vigente para emitir tus boletas en el SII.",
    "bhe_pausada": "La emisión automática está pausada. Inténtalo más tarde o emite en el portal del SII.",
    "estado_invalido": "La boleta de este cobro no está en un estado que permita esta acción.",
    "receptor_incompleto": "Para emitir en el SII la boleta necesita RUT, nombre, dirección y comuna del receptor.",
    "comuna_desconocida": "No reconocemos la comuna del receptor. Corrígela en el cobro.",
    "fuera_de_plazo": (
        "Pasó el plazo para anular la boleta directamente (día 10 del mes siguiente a su emisión). "
        "Ahora el SII exige que el receptor confirme la anulación o presentar el formulario 2117. "
        "Hazlo en el portal del SII y después márcala como anulada aquí."
    ),
    "no_cancelable": "La boleta ya se está procesando en el SII y no se puede cancelar. Espera a que termine.",
    "confirmacion_requerida": "Confirma los datos de la boleta antes de enviarla al SII.",
    "folio_requerido": "Indica el folio que muestra el SII.",
    "folio_ocupado": "Ese folio ya está registrado en otro cobro.",
    "pdf_invalido": "Sube el PDF de la boleta tal como lo descargaste del SII.",
    "pdf_otro_folio": "Este PDF no parece ser la boleta.",
}

# Códigos que se responden con 403: el usuario no puede usar la emisión automática.
CODIGOS_BLOQUEO = {"plan_required", "bhe_no_disponible", "delegacion_inactiva", "bhe_pausada"}

Estado = EmisionBHE.Estado
Tipo = EmisionBHE.Tipo


class EmisionNoPermitida(Exception):
    def __init__(self, codigo, detalle=""):
        self.codigo = codigo
        self.detalle = detalle or MENSAJES[codigo]
        super().__init__(self.detalle)


def delegacion_vigente(delegacion):
    return bool(
        delegacion
        and delegacion.verificada
        and delegacion.estado in (DelegacionSII.Estado.ACTIVA, DelegacionSII.Estado.POR_VENCER)
        # El día del vencimiento ya no se emite, aunque la tarea diaria todavía no la haya marcado vencida.
        and (delegacion.fecha_vencimiento is None or delegacion.fecha_vencimiento > timezone.localdate())
    )


AVISOS_VENCIMIENTO = (1, 7, 30)


def revisar_vencimientos():
    """Tarea diaria: POR_VENCER a 30 días (con aviso a 30, 7 y 1) y VENCIDA el día del vencimiento.

    Sin fecha de vencimiento no se hace nada: esa vigencia la confirman el canario y los errores al emitir.
    """
    from notificaciones.services import enqueue_delegation_expiry_notice

    hoy = timezone.localdate()
    delegaciones = DelegacionSII.objects.select_related("psicologo").filter(
        verificada=True,
        estado__in=(DelegacionSII.Estado.ACTIVA, DelegacionSII.Estado.POR_VENCER),
        fecha_vencimiento__isnull=False,
    )
    for delegacion in delegaciones:
        dias = (delegacion.fecha_vencimiento - hoy).days
        if dias <= 0:
            delegacion.estado = DelegacionSII.Estado.VENCIDA
            delegacion.save(update_fields=["estado", "updated_at"])
            logger.info("Delegación %s vencida", delegacion.pk)
            continue
        if dias > AVISOS_VENCIMIENTO[-1]:
            continue
        if delegacion.estado != DelegacionSII.Estado.POR_VENCER:
            delegacion.estado = DelegacionSII.Estado.POR_VENCER
            delegacion.save(update_fields=["estado", "updated_at"])
        # El umbral más cercano (30, 7 o 1): la clave del correo evita repetirlo los días siguientes.
        aviso = next(umbral for umbral in AVISOS_VENCIMIENTO if dias <= umbral)
        enqueue_delegation_expiry_notice(delegacion, aviso)


DIAS_RECORDATORIO_ANULACION = 3


def recordar_anulaciones():
    """Recuerda anular en el SII las boletas pedidas y no marcadas, unos días antes del plazo simple."""
    from notificaciones.services import enqueue_cancellation_reminder

    cobros = Cobro.objects.select_related("psicologo").filter(
        estado_boleta=Cobro.EstadoBoleta.EMITIDA,
        anulacion_solicitada_at__isnull=False,
        boleta_fecha_emision__isnull=False,
    )
    hoy = hoy_chile()
    for cobro in cobros:
        dias = (anulable_hasta(cobro.boleta_fecha_emision) - hoy).days
        # Pasado el plazo el camino es otro (receptor o formulario 2117) y la ficha lo explica.
        # Si la pidió hoy, la está anulando ahora: no hace falta recordárselo.
        pedida_hoy = timezone.localdate(cobro.anulacion_solicitada_at, timezone=HORA_CHILE) == hoy
        if 0 <= dias <= DIAS_RECORDATORIO_ANULACION and not pedida_hoy:
            enqueue_cancellation_reminder(cobro)


def _cola_detenida():
    return not settings.BHE_AUTO_DISPONIBLE or ConfiguracionBHE.cola_pausada()


def motivo_bloqueo(usuario):
    """Código de por qué el usuario no puede pedir emisiones automáticas, o None."""
    suscripcion = getattr(usuario, "suscripcion", None)
    if not (usuario.is_staff or usuario.is_superuser or (suscripcion and suscripcion.tiene_boletas)):
        return "plan_required"
    if not settings.BHE_AUTO_DISPONIBLE:
        return "bhe_no_disponible"
    delegacion = DelegacionSII.objects.filter(psicologo=usuario).first()
    if not delegacion_vigente(delegacion):
        return "delegacion_inactiva"
    if ConfiguracionBHE.cola_pausada():
        return "bhe_pausada"
    return None


def datos_desde_cobro(cobro, rut_emisor, fecha):
    retencion = RETENCION_POR_MODO.get(cobro.bhe_modo)
    campos = (cobro.receptor_documento, cobro.receptor_nombre, cobro.receptor_direccion, cobro.receptor_comuna)
    if retencion is None or cobro.receptor_tipo_doc != "RUT" or not all(c.strip() for c in campos):
        raise EmisionNoPermitida("receptor_incompleto")
    comuna = buscar_comuna(cobro.receptor_comuna)
    if comuna is None:
        raise EmisionNoPermitida("comuna_desconocida")
    return DatosBoleta(
        rut_emisor=rut_emisor,
        receptor=Receptor(
            rut=cobro.receptor_documento,
            nombre=cobro.receptor_nombre.strip(),
            domicilio=cobro.receptor_direccion.strip(),
            region=comuna.region_sii,
            comuna=comuna.nombre_sii,
        ),
        fecha=fecha,
        retencion=retencion,
        lineas=(LineaBoleta(nombre=cobro.glosa, monto=cobro.monto_bruto),),
    )


def datos_desde_payload(payload):
    return DatosBoleta(
        rut_emisor=payload["rut_emisor"],
        receptor=Receptor(**payload["receptor"]),
        fecha=date.fromisoformat(payload["fecha"]),
        retencion=payload["retencion"],
        lineas=tuple(LineaBoleta(**linea) for linea in payload["lineas"]),
    )


def _encolar(emision_id, countdown=0):
    from .tasks import procesar_emision_bhe

    procesar_emision_bhe.apply_async((emision_id,), countdown=countdown)


def _programar_busqueda(emision_id, busqueda, countdown=None):
    from .tasks import conciliar_emision_bhe

    espera = ESPERAS_BUSQUEDA[busqueda] if countdown is None else countdown
    conciliar_emision_bhe.apply_async((emision_id, busqueda), countdown=espera)


def solicitar_emision(cobro, usuario):
    """Deja en cola la emisión del cobro. Repetir la solicitud devuelve la emisión ya activa."""
    codigo = motivo_bloqueo(usuario)
    if codigo:
        raise EmisionNoPermitida(codigo)
    with transaction.atomic():
        cobro = Cobro.objects.select_for_update().get(pk=cobro.pk)
        if cobro.estado_boleta == Cobro.EstadoBoleta.ANULADA:
            # Boleta nueva para un cobro cuya boleta se anuló: otra clave, y sin rastro de la anterior en el cobro
            # (el folio anulado queda en sus EmisionBHE).
            cobro.version_emision += 1
            cobro.boleta_folio = ""
            cobro.boleta_fecha_emision = None
            cobro.boleta_anulada_at = None
            cobro.anulacion_solicitada_at = None
            cobro.anulacion_solicitada_por = None
        else:
            activa = cobro.emisiones.filter(tipo=Tipo.EMISION, estado__in=EmisionBHE.ESTADOS_ACTIVOS).first()
            if activa:
                return activa
            if cobro.estado_boleta != Cobro.EstadoBoleta.PENDIENTE:
                raise EmisionNoPermitida("estado_invalido")
        datos = datos_desde_cobro(cobro, usuario.delegacion_sii.rut_emisor, timezone.localdate())
        emision = EmisionBHE.objects.create(
            cobro=cobro,
            tipo=Tipo.EMISION,
            idempotency_key=EmisionBHE.clave_idempotencia(cobro, Tipo.EMISION),
            payload=json.dumps(asdict(datos), default=str),
            solicitado_por=usuario,
            backend=settings.BHE_BACKEND,
        )
        cobro.estado_boleta = Cobro.EstadoBoleta.EN_EMISION
        cobro.save()
        transaction.on_commit(lambda: _encolar(emision.pk))
    return emision


def solicitar_anulacion(cobro, usuario):
    """El psicólogo va a anular la boleta en el SII. La cuenta autorizada no puede anular ni ver sus boletas."""
    with transaction.atomic():
        cobro = Cobro.objects.select_for_update().get(pk=cobro.pk)
        if cobro.estado_boleta != Cobro.EstadoBoleta.EMITIDA:
            raise EmisionNoPermitida("estado_invalido")
        if cobro.anulacion_solicitada_at is None:
            cobro.anulacion_solicitada_at = timezone.now()
            cobro.anulacion_solicitada_por = usuario
            cobro.save(update_fields=["anulacion_solicitada_at", "anulacion_solicitada_por", "updated_at"])
    return cobro


def registrar_anulacion(cobro, usuario):
    """«Ya la anulé»: no se puede verificar en el SII, así que queda registrado quién lo marcó y cuándo."""
    with transaction.atomic():
        cobro = Cobro.objects.select_for_update().get(pk=cobro.pk)
        if cobro.estado_boleta != Cobro.EstadoBoleta.EMITIDA:
            raise EmisionNoPermitida("estado_invalido")
        ahora = timezone.now()
        cobro.emisiones.filter(tipo=Tipo.EMISION, estado=Estado.EMITIDA).update(estado=Estado.ANULADA)
        EmisionBHE.objects.create(
            cobro=cobro,
            tipo=Tipo.ANULACION,
            idempotency_key=EmisionBHE.clave_idempotencia(cobro, Tipo.ANULACION),
            estado=Estado.REGISTRADA,
            folio=cobro.boleta_folio,
            solicitado_por=cobro.anulacion_solicitada_por,
            resuelta_por=usuario,
            resuelta_at=ahora,
            finished_at=ahora,
            backend="manual",
        )
        cobro.estado_boleta = Cobro.EstadoBoleta.ANULADA
        cobro.boleta_anulada_at = ahora
        cobro.save(update_fields=["estado_boleta", "boleta_anulada_at", "updated_at"])
    logger.info("Cobro %s: boleta marcada anulada por el usuario %s.", cobro.pk, usuario.pk)
    return cobro


def cancelar_emision(cobro):
    """Saca de la cola una emisión que el worker todavía no toma."""
    with transaction.atomic():
        pendiente = cobro.emisiones.filter(estado=Estado.PENDIENTE).values_list("pk", flat=True).first()
        # El lock va sobre la emisión: si un worker la está tomando, se espera y se vuelve a
        # comprobar el estado, así que nunca se cancela una que ya pasó a EN_CURSO.
        emision = _bloquear(pendiente, Estado.PENDIENTE) if pendiente else None
        if emision is None:
            raise EmisionNoPermitida("no_cancelable")
        cobro = Cobro.objects.select_for_update().get(pk=emision.cobro_id)
        emision.estado = Estado.CANCELADA
        emision.finished_at = timezone.now()
        emision.save(update_fields=["estado", "finished_at"])
        if emision.tipo == Tipo.EMISION and cobro.estado_boleta == Cobro.EstadoBoleta.EN_EMISION:
            cobro.estado_boleta = Cobro.EstadoBoleta.PENDIENTE
        # Una nueva solicitud lleva otra clave de idempotencia.
        cobro.version_emision += 1
        cobro.save(update_fields=["estado_boleta", "version_emision", "updated_at"])
    logger.info("Emisión BHE %s cancelada.", emision.pk)
    return emision


def resolver_manual(emision_id, usuario, hecha, folio="", fecha=None, codigo=""):
    """El operador revisó en el portal del SII una emisión por confirmar.

    `hecha` dice si la boleta aparece en el SII; si aparece, se necesita el folio y después se intenta bajar el PDF.
    """
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.DESCONOCIDO)
        if emision is None:
            raise EmisionNoPermitida("estado_invalido")
        cobro = Cobro.objects.select_for_update().get(pk=emision.cobro_id)
        ahora = timezone.now()
        if hecha:
            if not folio:
                raise EmisionNoPermitida("folio_requerido")
            if _folio_ocupado(emision, folio):
                raise EmisionNoPermitida("folio_ocupado")
            emision.folio = folio
            emision.codigo_sii = codigo
            cobro.estado_boleta = Cobro.EstadoBoleta.EMITIDA
            cobro.boleta_folio = folio
            cobro.boleta_fecha_emision = fecha or date.fromisoformat(json.loads(emision.payload)["fecha"])
            cobro.boleta_anulada_at = None
        else:
            # No está en el SII: el cobro vuelve a quedar disponible y la boleta sigue como estaba.
            if emision.tipo == Tipo.EMISION and cobro.estado_boleta == Cobro.EstadoBoleta.EN_EMISION:
                cobro.estado_boleta = Cobro.EstadoBoleta.PENDIENTE
            cobro.version_emision += 1
            emision.error_codigo = "no_esta_en_sii"
            emision.error_detalle = "El operador confirmó en el portal que no quedó hecha en el SII."
        emision.estado = Estado.EMITIDA if hecha else Estado.FALLIDA
        emision.paso = ""
        emision.resuelta_por = usuario
        emision.resuelta_at = ahora
        emision.finished_at = ahora
        emision.save()
        cobro.save()
        if hecha and emision.tipo == Tipo.EMISION and not emision.pdf:
            transaction.on_commit(lambda: _programar_recuperacion_pdf(emision_id))
    logger.info("Emisión BHE %s resuelta a mano por el usuario %s: %s.", emision_id, usuario.pk, emision.estado)
    return emision


def subir_pdf(emision, contenido):
    """El PDF que el psicólogo bajó de su SII, si la emisión quedó sin él."""
    if emision.tipo != Tipo.EMISION or emision.estado != Estado.EMITIDA or emision.pdf:
        raise EmisionNoPermitida("estado_invalido")
    revisar_pdf(emision, contenido)
    emision.pdf.save(f"boleta-{emision.folio}.pdf", ContentFile(contenido), save=False)
    emision.save(update_fields=["pdf"])
    logger.info("Emisión BHE %s: PDF subido por el psicólogo.", emision.pk)


def revisar_pdf(emision, contenido):
    """Que sea un PDF de boleta de honorarios con el folio de la emisión."""
    if not contenido.startswith(b"%PDF"):
        raise EmisionNoPermitida("pdf_invalido")
    try:
        texto = " ".join(pagina.extract_text() or "" for pagina in PdfReader(BytesIO(contenido)).pages)
    except Exception:
        raise EmisionNoPermitida("pdf_invalido")
    # El PDF del SII trae «BOLETA DE HONORARIOS», «ELECTRONICA» y «N ° 77» en líneas aparte: sin tildes ni
    # espacios (los saltos de línea se quedan para no pegar el folio con la línea siguiente).
    texto = "".join(c for c in unicodedata.normalize("NFD", texto) if not unicodedata.combining(c))
    texto = re.sub(r"[^\S\n]+", "", texto).upper()
    # El «N° 83» de la «Res. Ex.» del pie no es el folio.
    folios = [folio for res, folio in re.findall(r"(RES\.?EX\.?)?N\s*[°º]\s*(\d+)", texto) if not res]
    if "BOLETADEHONORARIOS" not in texto or int(emision.folio) not in {int(folio) for folio in folios}:
        raise EmisionNoPermitida("pdf_otro_folio", f"Este PDF no parece ser la boleta N° {emision.folio}.")


def _programar_recuperacion_pdf(emision_id):
    from .tasks import recuperar_pdf_bhe

    recuperar_pdf_bhe.delay(emision_id)


def recuperar_pdf(emision_id):
    """Baja el PDF por la consulta de terceros del SII cuando la emisión quedó EMITIDA sin él.

    Se programa solo si falló la descarga tras el paso 4 o al resolver a mano con folio. Es un login
    aparte: un solo intento por emisión, marcado antes de tocar el SII. Si falla, el psicólogo lo sube.
    """
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.EMITIDA)
        if emision is None or emision.tipo != Tipo.EMISION or emision.pdf or not emision.folio:
            return
        if emision.pdf_recuperacion_at:
            return
        if _cola_detenida():
            logger.info("Emisión BHE %s: la cola está pausada, no se recupera el PDF.", emision.pk)
            return
        emision.pdf_recuperacion_at = timezone.now()
        emision.save(update_fields=["pdf_recuperacion_at"])

    payload = json.loads(emision.payload)
    cobro = emision.cobro
    try:
        contenido = get_emisor().recuperar_pdf(
            payload["rut_emisor"],
            emision.folio,
            payload["receptor"]["rut"],
            cobro.boleta_fecha_emision or date.fromisoformat(payload["fecha"]),
            emision.codigo_sii,
        )
        revisar_pdf(emision, contenido)
    except ErrorCredencial as exc:
        pausar_por_credencial(exc)
        return
    except Exception as exc:
        # Solo el código: el detalle de Playwright puede traer la URL con RUT y código.
        logger.warning("Emisión BHE %s: no se recuperó el PDF (%s).", emision.pk, getattr(exc, "codigo", type(exc).__name__))
        return

    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.EMITIDA)
        if emision is None or emision.pdf:
            return
        emision.pdf.save(f"boleta-{emision.folio}.pdf", ContentFile(contenido), save=False)
        emision.save(update_fields=["pdf"])
    logger.info("Emisión BHE %s: PDF recuperado por la consulta de terceros.", emision.pk)


def _bloquear(emision_id, *estados):
    """La emisión con lock si sigue en alguno de esos estados; si no, None. Usar dentro de atomic()."""
    return (
        EmisionBHE.objects.select_for_update()
        .select_related("cobro")
        .filter(pk=emision_id, estado__in=estados)
        .first()
    )


def procesar(emision_id):
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.PENDIENTE)
        if emision is None:
            return
        if _cola_detenida():
            # Queda en cola; reanudar_cola la vuelve a encolar.
            logger.info("Emisión BHE %s en espera: la cola está pausada.", emision.pk)
            return
        emision.estado = Estado.EN_CURSO
        emision.intentos += 1
        emision.started_at = timezone.now()
        emision.paso = ""
        emision.save(update_fields=["estado", "intentos", "started_at", "paso"])

    delegacion = DelegacionSII.objects.filter(psicologo_id=emision.cobro.psicologo_id).first()
    if not delegacion_vigente(delegacion):
        _fallar(emision.pk, "delegacion_inactiva", MENSAJES["delegacion_inactiva"])
        return
    try:
        emisor = get_emisor()
        payload = json.loads(emision.payload)
        datos = datos_desde_payload(payload)
    except Exception as exc:
        logger.exception("Emisión BHE %s: no se pudo preparar.", emision.pk)
        _fallar(emision.pk, "error_interno", str(exc))
        return

    # Confirmado en la base antes de tocar el SII: si el proceso muere desde aquí, no se reenvía.
    EmisionBHE.objects.filter(pk=emision.pk).update(paso=ANTES_SUBMIT)
    try:
        resultado = emisor.emitir(datos)
    except ErrorCredencial as exc:
        _devolver_por_credencial(emision.pk)
        pausar_por_credencial(exc)
    except ErrorAntesDeEnviar as exc:
        _reintentar_o_fallar(emision.pk, exc)
    except ErrorNegocio as exc:
        _fallar(emision.pk, exc.codigo, exc.detalle)
    except Exception as exc:
        # ErrorDespuesDeEnviar o un error inesperado: el formulario pudo quedar enviado.
        _marcar_desconocido(
            emision.pk,
            getattr(exc, "codigo", "error_inesperado"),
            str(exc),
            puede_buscar=emisor.puede_buscar,
            evidencias=getattr(emisor, "evidencias", ()),
        )
    else:
        _completar(emision.pk, resultado, Estado.EN_CURSO)


def _devolver_por_credencial(emision_id):
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.EN_CURSO)
        if emision is None:
            return
        # No fue culpa de esta boleta: el intento no se cuenta.
        emision.estado = Estado.PENDIENTE
        emision.intentos -= 1
        emision.paso = ""
        emision.error_codigo = "credencial_rechazada"
        emision.error_detalle = "El SII rechazó la clave de la cuenta autorizada; espera a que se reanude la cola."
        emision.save(update_fields=["estado", "intentos", "paso", "error_codigo", "error_detalle"])


def _reintentar_o_fallar(emision_id, exc):
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.EN_CURSO)
        if emision is None:
            return
        if emision.intentos > len(ESPERAS_REINTENTO):
            fallar = True
        else:
            fallar = False
            emision.estado = Estado.PENDIENTE
            emision.paso = ""
            emision.error_codigo = exc.codigo
            emision.error_detalle = ocultar(exc.detalle)
            emision.save(update_fields=["estado", "paso", "error_codigo", "error_detalle"])
            espera = ESPERAS_REINTENTO[emision.intentos - 1]
            transaction.on_commit(lambda: _encolar(emision_id, countdown=espera))
    if fallar:
        _fallar(emision_id, exc.codigo, exc.detalle)
    else:
        logger.warning("Emisión BHE %s: %s, se reintenta en %ss.", emision_id, exc.codigo, espera)


def _fallar(emision_id, codigo, detalle):
    """Fallo seguro: no quedó nada en el SII. El cobro vuelve a pendiente y se puede pedir otra vez."""
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.EN_CURSO)
        if emision is None:
            return
        cobro = Cobro.objects.select_for_update().get(pk=emision.cobro_id)
        emision.estado = Estado.FALLIDA
        emision.error_codigo = codigo
        emision.error_detalle = ocultar(detalle)
        emision.finished_at = timezone.now()
        emision.save(update_fields=["estado", "error_codigo", "error_detalle", "finished_at"])
        if emision.tipo == Tipo.EMISION and cobro.estado_boleta == Cobro.EstadoBoleta.EN_EMISION:
            cobro.estado_boleta = Cobro.EstadoBoleta.PENDIENTE
        cobro.version_emision += 1
        cobro.save(update_fields=["estado_boleta", "version_emision", "updated_at"])
    logger.warning("Emisión BHE %s fallida: %s.", emision_id, codigo)


def _marcar_desconocido(emision_id, codigo, detalle, puede_buscar=True, evidencias=()):
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.EN_CURSO)
        if emision is None:
            return
        emision.estado = Estado.DESCONOCIDO
        emision.paso = "BUSQUEDA_1"
        emision.error_codigo = codigo
        emision.error_detalle = ocultar(detalle)
        # Las capturas sirven para confirmarla a mano.
        _guardar_evidencias(emision, evidencias)
        emision.save(update_fields=["estado", "paso", "error_codigo", "error_detalle", "evidencias"])
        if puede_buscar:
            transaction.on_commit(lambda: _programar_busqueda(emision_id, 1))
    if not puede_buscar:
        # El usuario autorizado no ve las boletas en las consultas del SII: nunca reintento ni búsqueda.
        _a_revision(emision_id, codigo, ocultar(detalle))
        return
    logger.warning("Emisión BHE %s por confirmar (%s): se buscará en el SII.", emision_id, codigo)


def _guardar_archivos(emision, resultado):
    if resultado.pdf:
        emision.pdf.save(f"boleta-{resultado.folio}.pdf", ContentFile(resultado.pdf), save=False)
    _guardar_evidencias(emision, resultado.evidencias)


def _guardar_evidencias(emision, evidencias):
    storage = emision.pdf.storage
    for nombre, contenido in evidencias:
        ruta = storage.save(f"{emision.cobro.psicologo_id}/{emision.pk}/evidencias/{nombre}", ContentFile(contenido))
        emision.evidencias.append(ruta)


def _completar(emision_id, resultado, estado_esperado):
    """La boleta quedó emitida en el SII."""
    with transaction.atomic():
        emision = _bloquear(emision_id, estado_esperado)
        if emision is None:
            return
        cobro = Cobro.objects.select_for_update().get(pk=emision.cobro_id)
        emision.estado = Estado.EMITIDA
        emision.paso = ""
        emision.error_codigo = ""
        emision.error_detalle = ""
        emision.finished_at = timezone.now()
        emision.folio = resultado.folio
        emision.codigo_sii = resultado.codigo_sii
        emision.monto_retencion_sii = resultado.monto_retencion
        emision.monto_liquido_sii = resultado.monto_liquido
        _guardar_archivos(emision, resultado)
        informados = (resultado.monto_retencion, resultado.monto_liquido)
        if informados != (None, None) and informados != (cobro.monto_retencion, cobro.monto_liquido):
            # Queda emitida igual: el SII manda. Se avisa para revisar el cálculo.
            emision.error_codigo = "montos_distintos"
            emision.error_detalle = (
                f"El SII informó retención ${resultado.monto_retencion} y líquido ${resultado.monto_liquido}; "
                f"Psiconex calculó ${cobro.monto_retencion} y ${cobro.monto_liquido}."
            )
            logger.warning("Emisión BHE %s: los montos del SII no coinciden con el cobro.", emision.pk)
        cobro.estado_boleta = Cobro.EstadoBoleta.EMITIDA
        cobro.boleta_folio = resultado.folio
        cobro.boleta_fecha_emision = resultado.fecha
        emision.save()
        cobro.save()
        if emision.tipo == Tipo.EMISION and not emision.pdf:
            transaction.on_commit(lambda: _programar_recuperacion_pdf(emision_id))
    logger.info("Emisión BHE %s completada.", emision_id)


def _folio_ocupado(emision, folio):
    psicologo_id = emision.cobro.psicologo_id
    return (
        Cobro.objects.filter(psicologo_id=psicologo_id, boleta_folio=folio).exclude(pk=emision.cobro_id).exists()
        or EmisionBHE.objects.filter(cobro__psicologo_id=psicologo_id, tipo=Tipo.EMISION, folio=folio)
        .exclude(pk=emision.pk)
        .exists()
    )


def conciliar(emision_id, busqueda):
    """Busca en el SII una emisión DESCONOCIDO. Solo consulta: nunca reenvía."""
    emision = EmisionBHE.objects.select_related("cobro").filter(pk=emision_id, estado=Estado.DESCONOCIDO).first()
    if emision is None or emision.paso != f"BUSQUEDA_{busqueda}":
        return
    if _cola_detenida():
        # Se retoma al reanudar la cola.
        return
    payload = json.loads(emision.payload)
    rut_receptor, fecha = payload["receptor"]["rut"], payload["fecha"]
    monto = sum(linea["monto"] for linea in payload["lineas"])
    try:
        encontradas = get_emisor().buscar(payload["rut_emisor"], rut_receptor, date.fromisoformat(fecha), monto)
    except ErrorCredencial as exc:
        pausar_por_credencial(exc)
        return
    except Exception as exc:
        # Una búsqueda fallida cuenta como búsqueda: así nunca queda dando vueltas.
        logger.warning("Emisión BHE %s: la búsqueda %s falló (%s).", emision_id, busqueda, getattr(exc, "codigo", exc))
        encontradas = None

    candidatas = [r for r in encontradas or [] if not r.anulada and not _folio_ocupado(emision, r.folio)]
    if len(candidatas) == 1:
        _completar(emision_id, candidatas[0], Estado.DESCONOCIDO)
        return
    if len(candidatas) > 1:
        _a_revision(emision_id, "varias_coincidencias", "El SII muestra varias boletas que coinciden.")
        return

    if busqueda == 1:
        with transaction.atomic():
            if _bloquear(emision_id, Estado.DESCONOCIDO) is not None:
                EmisionBHE.objects.filter(pk=emision_id).update(paso="BUSQUEDA_2")
                transaction.on_commit(lambda: _programar_busqueda(emision_id, 2))
        return
    _a_revision(emision_id, "no_encontrada", "Tras dos búsquedas no se encontró en el SII.")


def _a_revision(emision_id, codigo, detalle):
    with transaction.atomic():
        emision = _bloquear(emision_id, Estado.DESCONOCIDO)
        if emision is None:
            return
        emision.paso = REVISION_MANUAL
        emision.error_codigo = codigo
        emision.error_detalle = f"{detalle} Revísala en el portal del SII antes de volver a emitir."
        emision.save(update_fields=["paso", "error_codigo", "error_detalle"])
    logger.error("Emisión BHE %s requiere revisión manual (%s).", emision_id, codigo)
    avisar_admins(
        f"Boleta por confirmar a mano (emisión #{emision_id})",
        f"La emisión BHE #{emision_id} no se pudo confirmar en el SII ({codigo}). "
        "Revisa el portal y resuélvela a mano; no se reenviará sola.",
    )


def pausar_por_credencial(exc):
    with transaction.atomic():
        config, _ = ConfiguracionBHE.objects.select_for_update().get_or_create(pk=1)
        if config.pausada:
            return
        config.pausada = True
        config.pausada_motivo = "El SII rechazó la clave de la cuenta autorizada."
        config.pausada_at = timezone.now()
        config.save()
    logger.error("Cola BHE pausada: el SII rechazó la clave de la cuenta autorizada (%s).", exc.codigo)
    avisar_admins(
        "Emisión de boletas pausada: el SII rechazó la clave",
        "El SII rechazó la clave de la cuenta autorizada y la emisión automática quedó pausada. "
        "No se reintentó para no bloquear la clave. Revísala y reanuda la cola en el admin (Configuración BHE).",
    )


def avisar_admins(asunto, mensaje):
    correos = list(
        get_user_model()
        .objects.filter(is_superuser=True, is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    if correos:
        send_mail(f"[Psiconex] {asunto}", mensaje, None, correos, fail_silently=True)


def reanudar_cola():
    """Al quitar la pausa: vuelve a encolar lo que esperaba. Lo que está en revisión manual no se toca."""
    for emision_id in EmisionBHE.objects.filter(estado=Estado.PENDIENTE).values_list("pk", flat=True):
        _encolar(emision_id)
    for emision_id, paso in EmisionBHE.objects.filter(
        estado=Estado.DESCONOCIDO, paso__in=["BUSQUEDA_1", "BUSQUEDA_2"]
    ).values_list("pk", "paso"):
        _programar_busqueda(emision_id, int(paso[-1]), countdown=0)


def rescatar_colgadas():
    """Emisiones EN_CURSO cuyo worker murió. Si ya iba a enviar, se busca; si no, se reintenta."""
    limite = timezone.now() - LIMITE_EN_CURSO
    for emision_id in EmisionBHE.objects.filter(estado=Estado.EN_CURSO, started_at__lt=limite).values_list(
        "pk", flat=True
    ):
        with transaction.atomic():
            emision = _bloquear(emision_id, Estado.EN_CURSO)
            if emision is None or emision.started_at >= limite:
                continue
            if emision.paso == ANTES_SUBMIT:
                emision.estado = Estado.DESCONOCIDO
                emision.paso = "BUSQUEDA_1"
                emision.error_codigo = "worker_caido"
                emision.error_detalle = "El proceso se cortó mientras enviaba al SII."
                transaction.on_commit(lambda pk=emision_id: _programar_busqueda(pk, 1, countdown=0))
            else:
                emision.estado = Estado.PENDIENTE
                transaction.on_commit(lambda pk=emision_id: _encolar(pk))
            emision.save(update_fields=["estado", "paso", "error_codigo", "error_detalle"])
        logger.warning("Emisión BHE %s rescatada tras quedar en curso.", emision_id)


def purgar_evidencias():
    """Borra las capturas del portal con más de 90 días. El PDF de la boleta se conserva.

    Recorre el disco y no la base, para alcanzar también las capturas de cobros ya borrados.
    """
    limite = timezone.now() - RETENCION_EVIDENCIAS
    storage = EmisionBHE._meta.get_field("pdf").storage
    borradas = 0
    for archivo in Path(storage.location).glob("*/*/evidencias/*"):
        if archivo.is_file() and archivo.stat().st_mtime < limite.timestamp():
            archivo.unlink()
            borradas += 1
    for emision in EmisionBHE.objects.filter(created_at__lt=limite).exclude(evidencias=[]).only("id", "evidencias"):
        restantes = [ruta for ruta in emision.evidencias if storage.exists(ruta)]
        if restantes != emision.evidencias:
            EmisionBHE.objects.filter(pk=emision.pk).update(evidencias=restantes)
    logger.info("Purga de evidencias BHE: %s capturas borradas.", borradas)
    return borradas
