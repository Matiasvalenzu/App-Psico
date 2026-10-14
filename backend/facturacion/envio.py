import re
from urllib.parse import quote

from django.core import signing
from django.core.signing import BadSignature
from django.urls import reverse

from notificaciones.services import send_branded_email

from .models import Cobro, EmisionBHE, EnvioBoleta

PDF_SALT = "facturacion.pdf-boleta"
PDF_MAX_AGE = 7 * 24 * 60 * 60


class EnvioNoDisponible(Exception):
    pass


def formato_clp(monto):
    return "$" + f"{int(monto):,}".replace(",", ".")


def telefono_whatsapp(telefono):
    """Dígitos listos para wa.me, con prefijo 56. Vacío si no es un móvil chileno reconocible."""
    digitos = re.sub(r"\D", "", telefono or "")
    if digitos.startswith("56") and len(digitos) == 11 and digitos[2] == "9":
        return digitos
    if len(digitos) == 9 and digitos.startswith("9"):
        return f"56{digitos}"
    return ""


def emision_con_pdf(cobro):
    if cobro.estado_boleta != Cobro.EstadoBoleta.EMITIDA or not cobro.boleta_folio:
        return None
    for emision in cobro.emisiones.all():
        if (
            emision.tipo == EmisionBHE.Tipo.EMISION
            and emision.estado == EmisionBHE.Estado.EMITIDA
            and emision.pdf
        ):
            return emision
    return None


def firmar_pdf(cobro_id, emision_id):
    return signing.dumps({"c": cobro_id, "e": emision_id}, salt=PDF_SALT, compress=True)


def abrir_pdf(token):
    try:
        data = signing.loads(token, salt=PDF_SALT, max_age=PDF_MAX_AGE)
    except BadSignature:
        return None
    emision = (
        EmisionBHE.objects.select_related("cobro")
        .filter(
            pk=data.get("e"),
            cobro_id=data.get("c"),
            tipo=EmisionBHE.Tipo.EMISION,
            estado=EmisionBHE.Estado.EMITIDA,
        )
        .first()
    )
    if not emision or not emision.pdf or emision.cobro.estado_boleta != Cobro.EstadoBoleta.EMITIDA:
        return None
    return emision


def url_pdf_publico(request, cobro, emision):
    token = firmar_pdf(cobro.pk, emision.pk)
    return request.build_absolute_uri(reverse("boleta-publica", kwargs={"token": token}))


def _nombre_paciente(cobro):
    if not cobro.paciente:
        return ""
    return (cobro.paciente.nombre or "").strip()


def mensaje_whatsapp(cobro, url_pdf):
    nombre = _nombre_paciente(cobro)
    saludo = f"Hola {nombre}" if nombre else "Hola"
    return (
        f"{saludo}, te envío la boleta de honorarios por {formato_clp(cobro.monto_bruto)}. "
        f"Folio {cobro.boleta_folio}. Descarga el PDF aquí: {url_pdf}"
    )


def enlace_whatsapp(cobro, request):
    emision = emision_con_pdf(cobro)
    if not emision:
        raise EnvioNoDisponible("La boleta todavía no tiene un PDF para compartir.")
    telefono = telefono_whatsapp(cobro.paciente.telefono_whatsapp if cobro.paciente else "")
    if not telefono:
        raise EnvioNoDisponible("El paciente no tiene un teléfono de WhatsApp. Complétalo en la ficha.")
    url_pdf = url_pdf_publico(request, cobro, emision)
    return f"https://wa.me/{telefono}?text={quote(mensaje_whatsapp(cobro, url_pdf))}"


def _email_paciente(cobro):
    if not cobro.paciente:
        return ""
    return (cobro.paciente.email_contacto or "").strip()


def enviar_boleta_correo(cobro, usuario):
    emision = emision_con_pdf(cobro)
    if not emision:
        raise EnvioNoDisponible("La boleta todavía no tiene un PDF para adjuntar.")
    destinatario = _email_paciente(cobro)
    if not destinatario:
        raise EnvioNoDisponible("El paciente no tiene correo. Complétalo en la ficha.")
    nombre = _nombre_paciente(cobro) or "hola"
    psicologo = usuario.get_full_name() or usuario.username
    with emision.pdf.open("rb") as archivo:
        pdf = archivo.read()
    send_branded_email(
        subject=f"Boleta de honorarios N° {cobro.boleta_folio}",
        recipient=destinatario,
        template_name="boleta_paciente",
        context={
            "patient_name": nombre,
            "psychologist_name": psicologo,
            "folio": cobro.boleta_folio,
            "monto": formato_clp(cobro.monto_bruto),
        },
        reply_to=usuario.email or None,
        attachments=[(f"boleta-{cobro.boleta_folio}.pdf", pdf, "application/pdf")],
    )
    return EnvioBoleta.objects.create(cobro=cobro, destinatario=destinatario, enviado_por=usuario)


def datos_envio(cobro):
    paciente = cobro.paciente
    envios = list(cobro.envios.all())
    ultimo = envios[0] if envios else None
    return {
        "puede_pdf": emision_con_pdf(cobro) is not None,
        "tiene_telefono": bool(telefono_whatsapp(paciente.telefono_whatsapp if paciente else "")),
        "email": (paciente.email_contacto if paciente else "") or "",
        "ultimo_correo": (
            {
                "enviado_at": ultimo.enviado_at,
                "usuario": ultimo.enviado_por.username if ultimo.enviado_por else "",
                "destinatario": ultimo.destinatario,
            }
            if ultimo
            else None
        ),
    }
