from datetime import date, timedelta
from unittest import mock

from django.core import mail
from django.test import TestCase, override_settings

from notificaciones.models import NotificacionEmail
from notificaciones.tasks import send_notification

from . import bhe
from .models import DelegacionSII
from .tasks import revisar_vencimientos_bhe
from .test_bhe import EntornoBHE, preparar_psicologo

HOY = date(2026, 10, 12)


def en_fecha(fecha):
    return mock.patch("django.utils.timezone.localdate", return_value=fecha)


@override_settings(BHE_RUT_AUTORIZADO="77.781.977-1", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class VencimientoDelegacionTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.delegacion = self.user.delegacion_sii
        self.delegacion.rut_emisor = "11.111.111-1"
        self.delegacion.fecha_otorgada = HOY
        self.delegacion.fecha_vencimiento = date(2027, 10, 12)
        self.delegacion.save()

    def revisar(self, fecha):
        with en_fecha(fecha), self.captureOnCommitCallbacks(execute=True), mock.patch(
            "notificaciones.services._schedule"
        ):
            revisar_vencimientos_bhe()
        self.delegacion.refresh_from_db()

    def avisos(self):
        return NotificacionEmail.objects.filter(tipo=NotificacionEmail.Tipo.DELEGACION_POR_VENCER)

    def test_avisos_a_30_7_y_1_dias_y_vence(self):
        vence = self.delegacion.fecha_vencimiento
        self.revisar(vence - timedelta(days=31))
        self.assertEqual(self.delegacion.estado, DelegacionSII.Estado.ACTIVA)
        self.assertFalse(self.avisos().exists())

        # Corre todos los días: un solo correo por umbral.
        for dias in range(30, 0, -1):
            self.revisar(vence - timedelta(days=dias))
        self.assertEqual(self.delegacion.estado, DelegacionSII.Estado.POR_VENCER)
        claves = sorted(self.avisos().values_list("clave_deduplicacion", flat=True))
        self.assertEqual(claves, sorted(
            f"vencimiento_bhe:{dias}d:{self.user.pk}:2027-10-12" for dias in (1, 7, 30)
        ))
        self.assertEqual(set(self.avisos().values_list("destinatario", flat=True)), {self.user.email})

        self.revisar(vence)
        self.assertEqual(self.delegacion.estado, DelegacionSII.Estado.VENCIDA)
        self.assertEqual(self.avisos().count(), 3)  # El día que vence no hay correo.

    def test_aviso_atrasado_si_la_tarea_no_corrio(self):
        self.revisar(self.delegacion.fecha_vencimiento - timedelta(days=5))
        self.assertEqual(
            list(self.avisos().values_list("clave_deduplicacion", flat=True)),
            [f"vencimiento_bhe:7d:{self.user.pk}:2027-10-12"],
        )

    def test_sin_fecha_de_vencimiento_no_hace_nada(self):
        self.delegacion.fecha_vencimiento = None
        self.delegacion.save()
        self.revisar(date(2030, 1, 1))
        self.assertEqual(self.delegacion.estado, DelegacionSII.Estado.ACTIVA)
        self.assertFalse(self.avisos().exists())
        with en_fecha(date(2030, 1, 1)):
            self.assertTrue(bhe.delegacion_vigente(self.delegacion))

    def test_solo_delegaciones_verificadas_y_vigentes(self):
        self.delegacion.estado = DelegacionSII.Estado.PENDIENTE_VERIFICACION
        self.delegacion.verificada = False
        self.delegacion.save()
        self.revisar(self.delegacion.fecha_vencimiento - timedelta(days=7))
        self.assertEqual(self.delegacion.estado, DelegacionSII.Estado.PENDIENTE_VERIFICACION)
        self.assertFalse(self.avisos().exists())

    def test_el_dia_del_vencimiento_ya_no_emite(self):
        vence = self.delegacion.fecha_vencimiento
        with en_fecha(vence - timedelta(days=1)):
            self.assertTrue(bhe.delegacion_vigente(self.delegacion))
            self.assertIsNone(bhe.motivo_bloqueo(self.user))
        # Aunque la tarea diaria todavía no la haya marcado vencida.
        with en_fecha(vence):
            self.assertFalse(bhe.delegacion_vigente(self.delegacion))
            self.assertEqual(bhe.motivo_bloqueo(self.user), "delegacion_inactiva")

    def test_correo_con_pasos_para_renovar(self):
        fecha = self.delegacion.fecha_vencimiento - timedelta(days=7)
        self.revisar(fecha)
        with en_fecha(fecha):
            self.assertEqual(send_notification(self.avisos().get().pk), "sent")
        correo = mail.outbox[0]
        self.assertEqual(correo.to, [self.user.email])
        self.assertIn("vence en 7 días", correo.subject)
        self.assertIn("Delegar emisión a un usuario autorizado", correo.body)
        self.assertIn("77.781.977-1", correo.body)
        self.assertIn("12 de octubre de 2027", correo.body)
        self.assertNotIn(self.delegacion.rut_emisor, correo.body)

    def test_renovada_antes_del_envio_se_omite(self):
        self.revisar(self.delegacion.fecha_vencimiento - timedelta(days=7))
        aviso = self.avisos().get()
        self.delegacion.estado = DelegacionSII.Estado.PENDIENTE_VERIFICACION
        self.delegacion.save()
        self.assertEqual(send_notification(aviso.pk), "skipped")
        self.assertEqual(mail.outbox, [])

    def test_renovar_reinicia_el_ciclo(self):
        self.revisar(self.delegacion.fecha_vencimiento - timedelta(days=7))
        # El operador verifica la renovación y anota la nueva fecha que muestra el SII.
        self.delegacion.estado = DelegacionSII.Estado.ACTIVA
        self.delegacion.fecha_vencimiento = date(2028, 10, 5)
        self.delegacion.save()
        self.revisar(date(2028, 10, 5) - timedelta(days=7))
        self.assertEqual(self.avisos().count(), 2)
        self.assertTrue(self.avisos().filter(clave_deduplicacion__endswith=":2028-10-05").exists())
