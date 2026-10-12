import io
import logging
import os
import time
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from . import bhe
from .emisores.fake import FakeEmisor
from .models import EmisionBHE
from .test_bhe import RUT_EMISOR, EntornoBHE, User, crear_cobro, preparar_psicologo
from .test_bhe_api import emitir

CLAVE = "Cl4ve-Secreta!"


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
        self.assertEqual(self.client.get(self.url_pdf(emision)).status_code, 200)

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

    def test_staff_ve_archivos_en_el_admin(self):
        emision = self.emitida()
        self.agregar_evidencia(emision, "antes.png")
        superusuario = User.objects.create_superuser(username="root", email="root@psiconex.cl", password="x")
        self.client.force_login(superusuario)
        cambio = self.client.get(reverse("admin:facturacion_emisionbhe_change", args=[emision.pk]))
        self.assertContains(cambio, "PDF de la boleta")
        self.assertContains(cambio, "Captura 1")

        staff = User.objects.create_user(username="staff", email="staff@psiconex.cl", password="x", is_staff=True)
        self.client.force_login(staff)
        captura = self.client.get(reverse("admin:facturacion_emisionbhe_evidencia", args=[emision.pk, 0]))
        self.assertEqual(captura.status_code, 200)
        self.assertEqual(b"".join(captura.streaming_content), b"png")
        self.assertEqual(self.client.get(reverse("admin:facturacion_emisionbhe_pdf", args=[emision.pk])).status_code, 200)
        self.assertEqual(
            self.client.get(reverse("admin:facturacion_emisionbhe_evidencia", args=[emision.pk, 5])).status_code, 404
        )

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
