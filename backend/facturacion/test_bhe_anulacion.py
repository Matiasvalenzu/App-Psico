from datetime import date, datetime, timezone as dt_timezone
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from notificaciones.models import NotificacionEmail
from notificaciones.tasks import send_notification
from pacientes.models import Paciente

from . import bhe
from .models import Cobro, EmisionBHE
from .services import plazo_anulacion_vencido
from .tasks import recordar_anulaciones_bhe
from .test_bhe import EntornoBHE, crear_cobro, preparar_psicologo
from .test_bhe_api import emitir

Estado = EmisionBHE.Estado
EMITIDA_EL = date(2026, 10, 5)  # Se puede anular hasta el 10 de noviembre.


def a_las(anio, mes, dia, hora=12):
    """Congela el reloj (en UTC)."""
    return mock.patch("django.utils.timezone.now", return_value=datetime(anio, mes, dia, hora, tzinfo=dt_timezone.utc))


class AnulacionManualTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)
        self.emision = emitir(self.cobro, self.user, self)

    def test_solicitar_no_crea_emision_y_es_idempotente(self):
        bhe.solicitar_anulacion(self.cobro, self.user)
        self.cobro.refresh_from_db()
        pedida = self.cobro.anulacion_solicitada_at
        self.assertIsNotNone(pedida)
        self.assertEqual(self.cobro.anulacion_solicitada_por, self.user)
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)
        bhe.solicitar_anulacion(self.cobro, self.user)
        self.cobro.refresh_from_db()
        self.assertEqual(self.cobro.anulacion_solicitada_at, pedida)
        self.assertFalse(self.cobro.emisiones.filter(tipo=EmisionBHE.Tipo.ANULACION).exists())

    def test_solicitar_fuera_de_plazo_se_permite(self):
        # Pasado el plazo igual se anula (receptor o formulario 2117); la ficha explica el camino.
        Cobro.objects.filter(pk=self.cobro.pk).update(boleta_fecha_emision=date(2026, 1, 5))
        bhe.solicitar_anulacion(self.cobro, self.user)
        self.cobro.refresh_from_db()
        self.assertIsNotNone(self.cobro.anulacion_solicitada_at)

    def test_solicitar_sin_boleta_emitida(self):
        otro = crear_cobro(self.user)
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            bhe.solicitar_anulacion(otro, self.user)
        self.assertEqual(ctx.exception.codigo, "estado_invalido")

    def test_registrar_deja_rastro(self):
        bhe.solicitar_anulacion(self.cobro, self.user)
        bhe.registrar_anulacion(self.cobro, self.user)
        self.cobro.refresh_from_db()
        self.emision.refresh_from_db()
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.ANULADA)
        self.assertIsNotNone(self.cobro.boleta_anulada_at)
        self.assertEqual(self.emision.estado, Estado.ANULADA)
        registro = self.cobro.emisiones.get(tipo=EmisionBHE.Tipo.ANULACION)
        self.assertEqual(registro.estado, Estado.REGISTRADA)
        self.assertEqual(registro.folio, self.cobro.boleta_folio)
        self.assertEqual(registro.solicitado_por, self.user)
        self.assertEqual(registro.resuelta_por, self.user)
        self.assertIsNotNone(registro.resuelta_at)
        self.assertEqual(registro.backend, "manual")
        with self.assertRaises(bhe.EmisionNoPermitida):
            bhe.registrar_anulacion(self.cobro, self.user)

    def test_reemitir_una_anulada(self):
        bhe.solicitar_anulacion(self.cobro, self.user)
        bhe.registrar_anulacion(self.cobro, self.user)
        folio_anulado = self.cobro.emisiones.get(tipo=EmisionBHE.Tipo.ANULACION).folio
        nueva = bhe.solicitar_emision(self.cobro, self.user)
        self.cobro.refresh_from_db()
        self.assertEqual(nueva.idempotency_key, f"cobro:{self.cobro.pk}:v2")
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EN_EMISION)
        self.assertEqual(self.cobro.boleta_folio, "")
        self.assertIsNone(self.cobro.boleta_fecha_emision)
        self.assertIsNone(self.cobro.boleta_anulada_at)
        self.assertIsNone(self.cobro.anulacion_solicitada_at)
        bhe.procesar(nueva.pk)
        self.cobro.refresh_from_db()
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)
        self.assertNotEqual(self.cobro.boleta_folio, folio_anulado)
        # La segunda anulación no choca con el registro de la primera.
        bhe.registrar_anulacion(self.cobro, self.user)
        self.assertEqual(self.cobro.emisiones.filter(estado=Estado.REGISTRADA).count(), 2)


class PlazoHoraChileTests(TestCase):
    def test_dia_10_en_la_noche_todavia_se_puede(self):
        # 11-nov 02:30 UTC = 10-nov 23:30 en Chile (UTC-3 en verano).
        with mock.patch("django.utils.timezone.now", return_value=datetime(2026, 11, 11, 2, 30, tzinfo=dt_timezone.utc)):
            self.assertFalse(plazo_anulacion_vencido(EMITIDA_EL))

    def test_dia_11_ya_vencio(self):
        with a_las(2026, 11, 11, 12):
            self.assertTrue(plazo_anulacion_vencido(EMITIDA_EL))


class ApiAnulacionTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)
        emitir(self.cobro, self.user, self)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def url(self, accion):
        return f"/api/facturacion/cobros/{self.cobro.pk}/{accion}/"

    def test_anular_sii_deja_pedida(self):
        respuesta = self.client.post(self.url("anular-sii"), {}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNotNone(respuesta.data["anulacion_solicitada_at"])
        self.assertEqual(respuesta.data["estado_boleta"], Cobro.EstadoBoleta.EMITIDA)
        self.assertFalse(respuesta.data["plazo_anulacion_vencido"])

    def test_anular_sii_sin_boleta(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(estado_boleta=Cobro.EstadoBoleta.PENDIENTE)
        respuesta = self.client.post(self.url("anular-sii"), {}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["code"], "estado_invalido")

    def test_plazo_vencido_en_la_ficha(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(boleta_fecha_emision=date(2026, 1, 5))
        respuesta = self.client.get(f"/api/facturacion/cobros/{self.cobro.pk}/")
        self.assertTrue(respuesta.data["plazo_anulacion_vencido"])

    def test_ya_la_anule(self):
        self.client.post(self.url("anular-sii"), {}, format="json")
        respuesta = self.client.post(self.url("marcar-anulada"))
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["estado_boleta"], Cobro.EstadoBoleta.ANULADA)
        self.assertEqual(respuesta.data["ultima_emision"]["estado"], Estado.REGISTRADA)
        self.assertEqual(self.client.post(self.url("marcar-anulada")).status_code, 400)

    def test_reemitir_exige_confirmacion(self):
        self.client.post(self.url("marcar-anulada"))
        respuesta = self.client.post(self.url("emitir-sii"), {}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["code"], "confirmacion_requerida")
        respuesta = self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        self.assertEqual(respuesta.status_code, 202)
        self.assertEqual(respuesta.data["estado_boleta"], Cobro.EstadoBoleta.EN_EMISION)

    def test_anulada_se_puede_editar(self):
        self.client.post(self.url("marcar-anulada"))
        respuesta = self.client.patch(f"/api/facturacion/cobros/{self.cobro.pk}/", {"monto_bruto": 300000}, format="json")
        self.assertEqual(respuesta.status_code, 200)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", PUBLIC_APP_URL="https://app.psiconex.cl")
class RecordatorioAnulacionTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.paciente = Paciente.objects.create(
            psicologo=self.user, nombre="Ana", apellido="Rojas", tipo_documento="RUT",
            numero_documento="111111111", direccion="Calle 1", comuna="Ñuñoa",
        )
        self.cobro = crear_cobro(
            self.user, paciente=self.paciente, estado_boleta=Cobro.EstadoBoleta.EMITIDA, boleta_folio="77",
            boleta_fecha_emision=EMITIDA_EL, anulacion_solicitada_at=datetime(2026, 11, 1, 15, tzinfo=dt_timezone.utc),
        )

    def recordar(self, *fecha):
        with a_las(*fecha), self.captureOnCommitCallbacks(execute=True), mock.patch("notificaciones.services._schedule"):
            recordar_anulaciones_bhe()

    def avisos(self):
        return NotificacionEmail.objects.filter(tipo=NotificacionEmail.Tipo.RECORDATORIO_ANULACION_BHE)

    def test_un_solo_recordatorio_desde_3_dias_antes(self):
        self.recordar(2026, 11, 6)
        self.assertFalse(self.avisos().exists())
        for dia in (7, 9, 10):
            self.recordar(2026, 11, dia)
        self.assertEqual(self.avisos().count(), 1)
        self.assertEqual(self.avisos().get().clave_deduplicacion, f"anulacion_bhe:{self.cobro.pk}:2026-11-10")

    def test_sin_recordatorio_pasado_el_plazo(self):
        self.recordar(2026, 11, 11)
        self.assertFalse(self.avisos().exists())

    def test_sin_recordatorio_si_no_la_pidio(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(anulacion_solicitada_at=None)
        self.recordar(2026, 11, 8)
        self.assertFalse(self.avisos().exists())

    def test_sin_recordatorio_si_la_pidio_hoy(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(anulacion_solicitada_at=datetime(2026, 11, 8, 13, tzinfo=dt_timezone.utc))
        self.recordar(2026, 11, 8, 20)
        self.assertFalse(self.avisos().exists())

    def test_sin_recordatorio_si_ya_la_anulo(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(estado_boleta=Cobro.EstadoBoleta.ANULADA)
        self.recordar(2026, 11, 8)
        self.assertFalse(self.avisos().exists())

    def test_correo_sin_nombre_del_paciente(self):
        self.recordar(2026, 11, 8)
        with a_las(2026, 11, 8, 13):
            self.assertEqual(send_notification(self.avisos().get().pk), "sent")
        correo = mail.outbox[0]
        html = correo.alternatives[0][0]
        self.assertIn("77", correo.subject)
        for cuerpo in (correo.body, html):
            self.assertIn("10 de noviembre de 2026", cuerpo)
            self.assertIn("Anular boletas emitidas", cuerpo)
            self.assertIn("2117", cuerpo)
            self.assertIn(f"https://app.psiconex.cl/dashboard/pacientes/{self.paciente.pk}?tab=cobros", cuerpo)
            self.assertNotIn("Ana", cuerpo)
            self.assertNotIn("Rojas", cuerpo)

    def test_se_omite_si_la_marco_antes_del_envio(self):
        self.recordar(2026, 11, 8)
        Cobro.objects.filter(pk=self.cobro.pk).update(estado_boleta=Cobro.EstadoBoleta.ANULADA)
        with a_las(2026, 11, 8, 13):
            self.assertEqual(send_notification(self.avisos().get().pk), "skipped")
        self.assertEqual(mail.outbox, [])
