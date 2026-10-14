import tempfile
import time
from unittest import mock
from urllib.parse import unquote

from django.core import mail
from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from pacientes.models import Paciente

from .envio import PDF_MAX_AGE, firmar_pdf, telefono_whatsapp
from .models import Cobro, EmisionBHE, EnvioBoleta
from .tests import URL, CobroApiTests


class TelefonoWhatsappTests(APITestCase):
    def test_normaliza_a_56(self):
        self.assertEqual(telefono_whatsapp("+56 9 8765 4321"), "56987654321")
        self.assertEqual(telefono_whatsapp("9 8765 4321"), "56987654321")
        self.assertEqual(telefono_whatsapp("987654321"), "56987654321")

    def test_rechaza_lo_que_no_es_movil_chileno(self):
        self.assertEqual(telefono_whatsapp(""), "")
        self.assertEqual(telefono_whatsapp("+1 202 555 0143"), "")
        self.assertEqual(telefono_whatsapp("22223333"), "")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", SECURE_SSL_REDIRECT=False)
class EnvioBoletaTests(CobroApiTests):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.storage = override_settings(BHE_STORAGE_PATH=self.tmp.name)
        self.storage.enable()
        super().setUp()
        self.paciente.telefono_whatsapp = "987654321"
        self.paciente.email_contacto = "ana.rojas@example.com"
        self.paciente.motivo_consulta = "F32 no debe salir"
        self.paciente.save()
        self.user.first_name = "Laura"
        self.user.last_name = "Soto"
        self.user.email = "laura@example.com"
        self.user.save()

    def tearDown(self):
        self.storage.disable()
        self.tmp.cleanup()
        super().tearDown()

    def emitida_con_pdf(self):
        cobro = Cobro.objects.get(pk=self.crear().data["id"])
        cobro.estado_boleta = Cobro.EstadoBoleta.EMITIDA
        cobro.boleta_folio = "83"
        cobro.boleta_fecha_emision = timezone.localdate()
        cobro.save()
        emision = EmisionBHE.objects.create(
            cobro=cobro,
            estado=EmisionBHE.Estado.EMITIDA,
            folio="83",
            idempotency_key=f"test-envio-{cobro.pk}",
            finished_at=timezone.now(),
        )
        emision.pdf.save("boleta.pdf", ContentFile(b"%PDF-1.4 boleta-ficticia"), save=True)
        return cobro

    def test_whatsapp_arma_el_link_y_no_envia_nada(self):
        cobro = self.emitida_con_pdf()
        response = self.client.get(f"{URL}{cobro.id}/enlace-whatsapp/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        url = response.data["url"]
        self.assertTrue(url.startswith("https://wa.me/56987654321?text="))
        texto = unquote(url.split("text=", 1)[1])
        self.assertIn("Hola Ana", texto)
        self.assertIn("$250.000", texto)
        self.assertIn("Folio 83", texto)
        self.assertIn("/api/facturacion/boletas/", texto)
        self.assertNotIn("F32", texto)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(EnvioBoleta.objects.count(), 0)

    def test_sin_telefono_no_arma_el_link(self):
        self.paciente.telefono_whatsapp = ""
        self.paciente.save()
        cobro = self.emitida_con_pdf()
        response = self.client.get(f"{URL}{cobro.id}/enlace-whatsapp/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ficha", response.data["detail"])

    def test_pdf_firmado_no_pide_login_y_vence(self):
        cobro = self.emitida_con_pdf()
        emision = cobro.emisiones.get()
        token = firmar_pdf(cobro.pk, emision.pk)
        anon = self.client_class()
        response = anon.get(f"/api/facturacion/boletas/{token}/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b"%PDF", b"".join(response.streaming_content))
        self.assertEqual(response["Cache-Control"], "no-store")

        futuro = time.time() + PDF_MAX_AGE + 60
        with mock.patch("django.core.signing.time.time", return_value=futuro):
            vencido = anon.get(f"/api/facturacion/boletas/{token}/", secure=True)
        self.assertEqual(vencido.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(anon.get("/api/facturacion/boletas/token-falso/", secure=True).status_code, 404)

    def test_correo_exige_confirmacion_y_registra_quien_lo_envio(self):
        cobro = self.emitida_con_pdf()
        url = f"{URL}{cobro.id}/enviar-correo/"
        sin_confirmar = self.client.post(url, {}, format="json", secure=True)
        self.assertEqual(sin_confirmar.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(EnvioBoleta.objects.count(), 0)

        response = self.client.post(url, {"confirmado": True}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(mail.outbox), 1)
        mensaje = mail.outbox[0]
        self.assertEqual(mensaje.to, ["ana.rojas@example.com"])
        self.assertEqual(mensaje.reply_to, ["laura@example.com"])
        self.assertIn("83", mensaje.subject)
        self.assertIn("$250.000", mensaje.body)
        self.assertNotIn("F32", mensaje.body)
        adjuntos = [a for a in mensaje.attachments if isinstance(a, tuple)]
        self.assertIn("boleta-83.pdf", [nombre for nombre, *_ in adjuntos])
        envio = EnvioBoleta.objects.get()
        self.assertEqual(envio.enviado_por, self.user)
        self.assertEqual(envio.destinatario, "ana.rojas@example.com")
        self.assertEqual(response.data["envio"]["ultimo_correo"]["usuario"], self.user.username)
        self.assertTrue(response.data["envio"]["puede_pdf"])

    def test_sin_mail_no_envia(self):
        Paciente.objects.filter(pk=self.paciente.pk).update(email_contacto="")
        cobro = self.emitida_con_pdf()
        response = self.client.post(
            f"{URL}{cobro.id}/enviar-correo/", {"confirmado": True}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_boleta_anulada_no_se_comparte(self):
        cobro = self.emitida_con_pdf()
        token = firmar_pdf(cobro.pk, cobro.emisiones.get().pk)
        cobro.estado_boleta = Cobro.EstadoBoleta.ANULADA
        cobro.save(update_fields=["estado_boleta"])
        anon = self.client_class()
        self.assertEqual(anon.get(f"/api/facturacion/boletas/{token}/", secure=True).status_code, 404)
        self.assertEqual(self.client.get(f"{URL}{cobro.id}/enlace-whatsapp/", secure=True).status_code, 400)
