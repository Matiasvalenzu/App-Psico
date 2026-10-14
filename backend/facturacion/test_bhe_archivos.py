import io
import json
import logging
import os
import time
from dataclasses import replace
from datetime import date
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import Permission
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from . import bhe
from .emisores import ErrorAntesDeEnviar
from .emisores.fake import FakeEmisor
from .models import ConfiguracionBHE, EmisionBHE
from .test_bhe import RUT_EMISOR, EntornoBHE, User, crear_cobro, preparar_psicologo
from .test_bhe_api import emision_por_confirmar, emitir

CLAVE = "Cl4ve-Secreta!"


# Sintética, con el formato del PDF real del SII (folio en otra línea, «N °», sin tildes) y datos inventados.
BOLETA_PDF = """BOLETA DE HONORARIOS
ELECTRONICA
N ° {folio}
JUANA PEREZ SOTO
RUT: 11.111.111-1
Fecha: 13 de Octubre de 2026
Total Honorarios: $: 1.000
Res. Ex. N° 83 de 30/08/2004"""


def pdf_con_texto(texto):
    """Un PDF mínimo de una página con ese texto (una línea por renglón), para que pypdf lo lea como del SII."""
    lineas = b" 0 -14 Td ".join(b"(" + linea.encode("cp1252") + b") Tj" for linea in texto.split("\n"))
    contenido = b"BT /F1 12 Tf 50 750 Td " + lineas + b" ET"
    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(contenido) + contenido + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    pdf, offsets = b"%PDF-1.4\n", []
    for numero, objeto in enumerate(objetos, 1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n" % numero + objeto + b"\nendobj\n"
    xref = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
    return pdf + b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, xref)


@override_settings(BHE_SII_CLAVE=CLAVE)
class LogsTests(SimpleTestCase):
    def capturar(self):
        salida = io.StringIO()
        handler = logging.StreamHandler(salida)
        logger = logging.getLogger("facturacion.prueba_logs")
        logger.addHandler(handler)
        self.addCleanup(logger.removeHandler, handler)
        return logger, salida

    def test_mensaje_y_excepcion_sin_clave_ni_rut(self):
        logger, salida = self.capturar()
        logger.warning("Login con %s para %s", CLAVE, RUT_EMISOR)
        try:
            raise RuntimeError(f"fill('#clave', '{CLAVE}') falló para 77781977-1")
        except RuntimeError:
            logger.exception("El robot cayó")
        texto = salida.getvalue()
        self.assertNotIn(CLAVE, texto)
        self.assertNotIn("781.977", texto)
        self.assertNotIn("77781977", texto)
        self.assertIn("[CLAVE]", texto)
        self.assertIn("77.***.***-1", texto)
        self.assertIn("Traceback", texto)

    def test_no_toca_numeros_que_no_son_rut(self):
        logger, salida = self.capturar()
        logger.warning("Cobro %s por $%s", 123, 250000)
        self.assertIn("Cobro 123 por $250000", salida.getvalue())

    def test_almacenamiento_fuera_de_media(self):
        ruta = Path(settings.BHE_STORAGE_PATH).resolve()
        self.assertFalse(ruta.is_relative_to(Path(settings.MEDIA_ROOT).resolve()))


@override_settings(BHE_SII_CLAVE=CLAVE)
class ErrorDetalleTests(EntornoBHE, TestCase):
    def test_error_del_robot_se_guarda_sin_clave(self):
        user = preparar_psicologo()
        cobro = crear_cobro(user)
        emision = bhe.solicitar_emision(cobro, user)
        error = RuntimeError(f"timeout escribiendo {CLAVE} para {RUT_EMISOR}")
        with mock.patch.object(FakeEmisor, "emitir", side_effect=error), self.assertLogs("facturacion") as logs:
            bhe.procesar(emision.pk)
        emision.refresh_from_db()
        self.assertTrue(emision.error_detalle)
        self.assertNotIn(CLAVE, emision.error_detalle)
        self.assertNotIn(RUT_EMISOR, emision.error_detalle)
        texto = "\n".join(logs.output)
        self.assertNotIn(CLAVE, texto)
        self.assertNotIn(RUT_EMISOR, texto)


class ArchivosTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def url_pdf(self, emision):
        return f"/api/facturacion/cobros/{self.cobro.pk}/emisiones/{emision.pk}/pdf/"

    def emitida(self):
        emision = emitir(self.cobro, self.user, self)
        emision.refresh_from_db()
        return emision

    def agregar_evidencia(self, emision, nombre, dias=0):
        storage = emision.pdf.storage
        ruta = storage.save(f"{self.user.pk}/{emision.pk}/evidencias/{nombre}", ContentFile(b"png"))
        emision.evidencias.append(ruta)
        emision.save(update_fields=["evidencias"])
        if dias:
            antes = time.time() - dias * 86400
            os.utime(storage.path(ruta), (antes, antes))
        return ruta

    def test_sin_url_publica(self):
        emision = self.emitida()
        with self.assertRaises(NotImplementedError):
            emision.pdf.url
        self.assertEqual(self.client.get(f"/{settings.MEDIA_URL}{emision.pdf.name}").status_code, 404)
        self.assertEqual(os.stat(emision.pdf.path).st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(os.path.dirname(emision.pdf.path)).st_mode & 0o777, 0o700)

    def subir(self, emision, contenido):
        archivo = SimpleUploadedFile("boleta.pdf", contenido, content_type="application/pdf")
        return self.client.post(self.url_pdf(emision), {"archivo": archivo}, format="multipart")

    def sin_pdf(self):
        # Como cuando el robot no alcanzó a bajarlo en la sesión de la emisión.
        emision = self.emitida()
        emision.pdf.delete(save=True)
        return emision

    def test_psicologo_sube_el_pdf_que_bajo_de_su_sii(self):
        emision = self.sin_pdf()
        # También si el texto sale con tilde o «N°» junto.
        for texto in ("BOLETA DE HONORARIOS ELECTRÓNICA N° {folio}", "Boleta de Honorarios\nElectrónica Nº{folio}"):
            self.assertEqual(self.subir(emision, pdf_con_texto(texto.format(folio=emision.folio))).status_code, 200)
            emision.refresh_from_db()
            emision.pdf.delete(save=True)
        contenido = pdf_con_texto(BOLETA_PDF.format(folio=emision.folio))
        respuesta = self.subir(emision, contenido)
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.json()["ultima_emision"]["tiene_pdf"])
        self.assertEqual(b"".join(self.client.get(self.url_pdf(emision)).streaming_content), contenido)

    def test_pdf_de_otra_boleta(self):
        emision = self.sin_pdf()
        # Otro folio, el número solo en la «Res. Ex.» del pie, o un documento que no es boleta de honorarios.
        otro_folio = BOLETA_PDF.format(folio=int(emision.folio) + 1)
        for texto in (otro_folio, otro_folio.replace("N° 83", f"N° {emision.folio}"),
                      BOLETA_PDF.format(folio=emision.folio).replace("BOLETA DE HONORARIOS", "FACTURA")):
            respuesta = self.subir(emision, pdf_con_texto(texto))
            self.assertEqual(respuesta.status_code, 400)
            self.assertEqual(respuesta.json()["detail"], f"Este PDF no parece ser la boleta N° {emision.folio}.")
        emision.refresh_from_db()
        self.assertFalse(emision.pdf)

    def test_archivo_que_no_es_pdf(self):
        emision = self.sin_pdf()
        for contenido in (b"<html></html>", b"%PDF-1.4 basura"):
            respuesta = self.subir(emision, contenido)
            self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (400, "pdf_invalido"))
        with override_settings(DOCUMENT_UPLOAD_MAX_BYTES=10):
            respuesta = self.subir(emision, pdf_con_texto(BOLETA_PDF.format(folio=emision.folio)))
        self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (400, "pdf_invalido"))
        emision.refresh_from_db()
        self.assertFalse(emision.pdf)

    def test_no_reemplaza_el_pdf_ni_sube_sin_plus_o_ajeno(self):
        emision = self.emitida()  # ya trae el PDF que bajó el robot
        contenido = pdf_con_texto(BOLETA_PDF.format(folio=emision.folio))
        respuesta = self.subir(emision, contenido)
        self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (400, "estado_invalido"))

        emision.pdf.delete(save=True)
        otro = APIClient()
        otro.force_authenticate(user=preparar_psicologo("otro@psiconex.cl"))
        archivo = SimpleUploadedFile("boleta.pdf", contenido, content_type="application/pdf")
        self.assertEqual(otro.post(self.url_pdf(emision), {"archivo": archivo}, format="multipart").status_code, 404)
        self.user.suscripcion.plan = "estandar"
        self.user.suscripcion.save()
        self.assertEqual(self.subir(emision, contenido).status_code, 403)
        emision.refresh_from_db()
        self.assertFalse(emision.pdf)

    def test_dueno_descarga_el_pdf(self):
        emision = self.emitida()
        respuesta = self.client.get(self.url_pdf(emision))
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(b"".join(respuesta.streaming_content).startswith(b"%PDF"))
        self.assertIn("attachment", respuesta["Content-Disposition"])
        self.assertEqual(respuesta["Content-Type"], "application/pdf")
        self.assertEqual(respuesta["Cache-Control"], "no-store")

    def test_descarga_tras_bajar_de_plan(self):
        emision = self.emitida()
        self.user.suscripcion.plan = "estandar"
        self.user.suscripcion.save()
        respuesta = self.client.get(self.url_pdf(emision))
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.json()["code"], "requiere_plus")

    def test_otro_psicologo_no_descarga(self):
        emision = self.emitida()
        otro = preparar_psicologo("otro@psiconex.cl")
        self.client.force_authenticate(user=otro)
        self.assertEqual(self.client.get(self.url_pdf(emision)).status_code, 404)

    def test_sin_pdf(self):
        emision = bhe.solicitar_emision(self.cobro, self.user)
        self.assertEqual(self.client.get(self.url_pdf(emision)).status_code, 404)

    def test_psicologo_no_descarga_capturas(self):
        emision = self.emitida()
        self.agregar_evidencia(emision, "antes.png")
        url = f"/api/facturacion/cobros/{self.cobro.pk}/emisiones/{emision.pk}/evidencias/0/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertNotIn("evidencias", self.client.get(f"/api/facturacion/cobros/{self.cobro.pk}/emisiones/").data[0])

    def test_solo_superusuario_ve_archivos_en_el_admin(self):
        emision = self.emitida()
        self.agregar_evidencia(emision, "antes.png")
        superusuario = User.objects.create_superuser(username="root", email="root@psiconex.cl", password="x")
        self.client.force_login(superusuario)
        cambio = self.client.get(reverse("admin:facturacion_emisionbhe_change", args=[emision.pk]))
        self.assertContains(cambio, "PDF de la boleta")
        self.assertContains(cambio, "Captura 1")

        captura = self.client.get(reverse("admin:facturacion_emisionbhe_evidencia", args=[emision.pk, 0]))
        self.assertEqual(captura.status_code, 200)
        self.assertEqual(b"".join(captura.streaming_content), b"png")
        self.assertEqual(self.client.get(reverse("admin:facturacion_emisionbhe_pdf", args=[emision.pk])).status_code, 200)
        self.assertEqual(
            self.client.get(reverse("admin:facturacion_emisionbhe_evidencia", args=[emision.pk, 5])).status_code, 404
        )

        staff = User.objects.create_user(username="staff", email="staff@psiconex.cl", password="x", is_staff=True)
        staff.user_permissions.add(Permission.objects.get(codename="view_emisionbhe"))
        self.client.force_login(staff)
        cambio = self.client.get(reverse("admin:facturacion_emisionbhe_change", args=[emision.pk]))
        self.assertEqual(cambio.status_code, 200)
        self.assertNotContains(cambio, "PDF de la boleta")
        self.assertNotContains(cambio, "Captura 1")
        for url in (
            reverse("admin:facturacion_emisionbhe_pdf", args=[emision.pk]),
            reverse("admin:facturacion_emisionbhe_evidencia", args=[emision.pk, 0]),
        ):
            self.assertEqual(self.client.get(url).status_code, 403)

        self.client.force_login(self.user)
        captura = self.client.get(reverse("admin:facturacion_emisionbhe_evidencia", args=[emision.pk, 0]))
        self.assertEqual(captura.status_code, 302)

    def test_cobro_con_boleta_emitida_no_se_borra(self):
        emision = self.emitida()
        respuesta = self.client.delete(f"/api/facturacion/cobros/{self.cobro.pk}/")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("Anúlala primero", str(respuesta.data))
        self.assertTrue(emision.pdf.storage.exists(emision.pdf.name))

    def test_purga_borra_capturas_viejas_y_conserva_el_pdf(self):
        emision = self.emitida()
        vieja = self.agregar_evidencia(emision, "vieja.png", dias=91)
        nueva = self.agregar_evidencia(emision, "nueva.png", dias=10)
        EmisionBHE.objects.filter(pk=emision.pk).update(created_at=timezone.now() - bhe.RETENCION_EVIDENCIAS)
        storage = emision.pdf.storage
        # Captura de un cobro ya borrado: también se purga.
        huerfana = storage.save("999/888/evidencias/x.png", ContentFile(b"png"))
        antes = time.time() - 91 * 86400
        os.utime(storage.path(huerfana), (antes, antes))

        self.assertEqual(bhe.purgar_evidencias(), 2)
        emision.refresh_from_db()
        self.assertFalse(storage.exists(vieja))
        self.assertFalse(storage.exists(huerfana))
        self.assertTrue(storage.exists(nueva))
        self.assertTrue(storage.exists(emision.pdf.name))
        self.assertEqual(emision.evidencias, [nueva])


class RecuperarPdfTests(EntornoBHE, TestCase):
    """Si el PDF no llegó al emitir, se pide una sola vez a la consulta de terceros del SII."""

    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)

    def emitida(self, con_pdf=True):
        original = FakeEmisor.emitir
        with self.captureOnCommitCallbacks(execute=True):
            emision = bhe.solicitar_emision(self.cobro, self.user)
        sin_pdf = lambda emisor, datos: replace(original(emisor, datos), pdf=b"")  # noqa: E731
        with mock.patch.object(FakeEmisor, "emitir", original if con_pdf else sin_pdf):
            with self.captureOnCommitCallbacks(execute=True):
                bhe.procesar(emision.pk)
        emision.refresh_from_db()
        self.cobro.refresh_from_db()
        return emision

    def test_se_programa_solo_si_falta_el_pdf(self):
        emision = self.emitida()
        self.assertTrue(emision.pdf)
        self.assertEqual(self.recuperaciones, [])
        self.cobro = crear_cobro(self.user)
        emision = self.emitida(con_pdf=False)
        self.assertEqual((emision.estado, bool(emision.pdf)), (EmisionBHE.Estado.EMITIDA, False))
        self.assertEqual(self.recuperaciones, [((emision.pk,), {})])

    def test_recupera_el_pdf_una_sola_vez(self):
        emision = self.emitida(con_pdf=False)
        with mock.patch.object(FakeEmisor, "recuperar_pdf", autospec=True, side_effect=FakeEmisor.recuperar_pdf) as consulta:
            bhe.recuperar_pdf(emision.pk)
            bhe.recuperar_pdf(emision.pk)
        payload = json.loads(emision.payload)
        consulta.assert_called_once_with(
            mock.ANY, RUT_EMISOR, emision.folio, payload["receptor"]["rut"], self.cobro.boleta_fecha_emision, emision.codigo_sii
        )
        emision.refresh_from_db()
        self.assertTrue(emision.pdf.name.endswith(f"boleta-{emision.folio}.pdf"))
        self.assertIsNotNone(emision.pdf_recuperacion_at)

    def test_si_falla_no_se_reintenta_y_el_psicologo_lo_sube(self):
        emision = self.emitida(con_pdf=False)
        for respuesta in (b"<html>No ha sido posible completar su solicitud</html>", pdf_con_texto("FACTURA N° 1")):
            EmisionBHE.objects.filter(pk=emision.pk).update(pdf_recuperacion_at=None)
            with mock.patch.object(FakeEmisor, "recuperar_pdf", return_value=respuesta):
                bhe.recuperar_pdf(emision.pk)
            emision.refresh_from_db()
            self.assertFalse(emision.pdf)
        with mock.patch.object(FakeEmisor, "recuperar_pdf") as consulta:
            bhe.recuperar_pdf(emision.pk)
        consulta.assert_not_called()
        bhe.subir_pdf(emision, pdf_con_texto(BOLETA_PDF.format(folio=emision.folio)))
        self.assertTrue(emision.pdf)

    def test_error_del_robot_se_loguea_sin_la_url(self):
        emision = self.emitida(con_pdf=False)
        error = ErrorAntesDeEnviar("portal_sin_respuesta", "page.goto: net::ERR_FAILED at https://loa.sii.cl/?txt_rutctr=12345678")
        with mock.patch.object(FakeEmisor, "recuperar_pdf", side_effect=error), self.assertLogs("facturacion", "WARNING") as logs:
            bhe.recuperar_pdf(emision.pk)
        self.assertIn("portal_sin_respuesta", logs.output[0])
        self.assertNotIn("12345678", "".join(logs.output))

    def test_con_la_cola_pausada_no_va_al_sii(self):
        emision = self.emitida(con_pdf=False)
        ConfiguracionBHE.objects.filter(pk=1).update(pausada=True)
        with mock.patch.object(FakeEmisor, "recuperar_pdf") as consulta:
            bhe.recuperar_pdf(emision.pk)
        consulta.assert_not_called()
        emision.refresh_from_db()
        self.assertIsNone(emision.pdf_recuperacion_at)

    def test_clave_rechazada_pausa_la_cola(self):
        emision = self.emitida(con_pdf=False)
        with self.escenario("credencial_rechazada"):
            bhe.recuperar_pdf(emision.pk)
        emision.refresh_from_db()
        self.assertFalse(emision.pdf)
        self.assertTrue(ConfiguracionBHE.cola_pausada())

    def test_tras_resolver_a_mano_usa_la_comprobacion(self):
        emision = emision_por_confirmar(self.cobro, self.user)
        operador = User.objects.create_superuser(username="operador", email="op@psiconex.cl", password="x")
        with self.captureOnCommitCallbacks(execute=True):
            bhe.resolver_manual(emision.pk, operador, hecha=True, folio="555", fecha=date(2026, 10, 9))
        self.assertEqual(self.recuperaciones, [((emision.pk,), {})])
        with mock.patch.object(FakeEmisor, "recuperar_pdf", autospec=True, side_effect=FakeEmisor.recuperar_pdf) as consulta:
            bhe.recuperar_pdf(emision.pk)
        self.assertEqual(consulta.call_args.args[2:], ("555", mock.ANY, date(2026, 10, 9), ""))
        emision.refresh_from_db()
        self.assertTrue(emision.pdf)
