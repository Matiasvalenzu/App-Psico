from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status

from sesiones.models import Sesion

from .models import CambioVinculoSesion, Cobro, EmisionBHE
from .tests import URL, CobroApiTests


class VinculoFlexibleTests(CobroApiTests):
    def sesion(self, numero, dia=13):
        return Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.user,
            numero_sesion=numero,
            fecha_hora_inicio=timezone.make_aware(datetime(2026, 10, dia, 11, 0)),
            estado=Sesion.Estado.COMPLETADO,
        )

    def vincular(self, cobro_id, sesiones):
        return self.client.post(f"{URL}{cobro_id}/vincular-sesiones/", {"sesiones": sesiones}, format="json", secure=True)

    def test_crea_con_sesiones_y_sin_sesiones(self):
        una = self.sesion(3, 1)
        otra = self.sesion(4, 13)
        con = self.crear(sesiones=[una.id, otra.id])
        self.assertEqual(con.status_code, status.HTTP_201_CREATED, con.data)
        self.assertCountEqual(con.data["sesiones"], [una.id, otra.id])
        sin = self.crear(sesiones=[])
        self.assertEqual(sin.status_code, status.HTTP_201_CREATED, sin.data)
        self.assertEqual(sin.data["sesiones"], [])
        self.assertIsNone(sin.data["sesion"])
        self.assertEqual(sin.data["sesiones_detalle"], [])

    def test_asociar_despues_desde_el_cobro_y_desde_la_sesion(self):
        libre = self.sesion(2, 8)
        cobro = Cobro.objects.get(pk=self.crear(sesiones=[]).data["id"])
        alta = self.vincular(cobro.id, [libre.id])
        self.assertEqual(alta.status_code, status.HTTP_200_OK, alta.data)
        self.assertEqual(alta.data["sesiones"], [libre.id])
        self.assertEqual(alta.data["glosa"], "Atención psicológica")
        cambio = CambioVinculoSesion.objects.get(cobro=cobro, accion=CambioVinculoSesion.Accion.ASOCIAR)
        self.assertEqual(cambio.usuario, self.user)
        self.assertEqual(cambio.numero_sesion, 2)
        self.assertIsNotNone(cambio.created_at)
        baja = self.vincular(cobro.id, [])
        self.assertEqual(baja.data["sesiones"], [])
        self.assertTrue(
            CambioVinculoSesion.objects.filter(cobro=cobro, accion=CambioVinculoSesion.Accion.QUITAR, usuario=self.user).exists()
        )
        otra = self.sesion(5, 9)
        suelto = Cobro.objects.get(pk=self.crear(sesiones=[]).data["id"])
        desde_sesion = self.vincular(suelto.id, [otra.id])
        self.assertEqual(desde_sesion.status_code, status.HTTP_200_OK, desde_sesion.data)
        self.assertEqual(desde_sesion.data["sesion"], otra.id)

    def test_una_sesion_no_puede_estar_en_dos_cobros(self):
        sesion = self.sesion(4)
        primero = self.crear(sesiones=[sesion.id])
        self.assertEqual(primero.status_code, status.HTTP_201_CREATED, primero.data)
        segundo = self.crear(sesiones=[sesion.id])
        self.assertEqual(segundo.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ya cobrada", str(segundo.data))
        otro = Cobro.objects.get(pk=self.crear(sesiones=[]).data["id"])
        respuesta = self.vincular(otro.id, [sesion.id])
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ya cobrada", str(respuesta.data))
        self.assertFalse(otro.sesiones.filter(pk=sesion.id).exists())

    def test_boleta_emitida_no_cambia_la_glosa_al_asociar(self):
        sesion = self.sesion(4)
        cobro = Cobro.objects.get(pk=self.crear(sesiones=[]).data["id"])
        cobro.estado_boleta = Cobro.EstadoBoleta.EMITIDA
        cobro.estado_pago = Cobro.EstadoPago.PAGADO
        cobro.boleta_folio = "83"
        cobro.glosa = "Atención psicológica"
        cobro.save(update_fields=["estado_boleta", "estado_pago", "boleta_folio", "glosa"])
        antes = EmisionBHE.objects.filter(cobro=cobro).count()
        respuesta = self.vincular(cobro.id, [sesion.id])
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK, respuesta.data)
        cobro.refresh_from_db()
        self.assertEqual(cobro.glosa, "Atención psicológica")
        self.assertFalse(cobro.glosa_incluye_sesion)
        self.assertEqual(cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)
        self.assertEqual(cobro.boleta_folio, "83")
        self.assertEqual(EmisionBHE.objects.filter(cobro=cobro).count(), antes)
        cobro.estado_boleta = Cobro.EstadoBoleta.ANULADA
        cobro.save(update_fields=["estado_boleta"])
        otra = self.sesion(6, 2)
        anulada = self.vincular(cobro.id, [sesion.id, otra.id])
        self.assertEqual(anulada.status_code, status.HTTP_200_OK, anulada.data)
        cobro.refresh_from_db()
        self.assertEqual(cobro.glosa, "Atención psicológica")
        self.assertEqual(cobro.estado_boleta, Cobro.EstadoBoleta.ANULADA)

    def test_sugerencia_solo_dentro_de_quince_dias(self):
        dentro = Cobro.objects.get(pk=self.crear(fecha_pago="2026-10-20", sesiones=[]).data["id"])
        self.crear(fecha_pago="2026-09-01", sesiones=[])
        self.crear(sesiones=[self.sesion(1, 20).id], fecha_pago="2026-10-20")
        cerca = self.client.get(f"{URL}sugerencia/?paciente={self.paciente.id}&fecha=2026-10-13", secure=True)
        self.assertEqual(cerca.status_code, status.HTTP_200_OK, cerca.data)
        self.assertEqual(cerca.data["cobro"]["id"], dentro.id)
        lejos = self.client.get(f"{URL}sugerencia/?paciente={self.paciente.id}&fecha=2026-11-10", secure=True)
        self.assertIsNone(lejos.data["cobro"])
        borde = self.client.get(f"{URL}sugerencia/?paciente={self.paciente.id}&fecha=2026-10-05", secure=True)
        self.assertEqual(borde.data["cobro"]["id"], dentro.id)
        fuera = (dentro.fecha_pago + timedelta(days=16)).isoformat()
        self.assertIsNone(self.client.get(f"{URL}sugerencia/?paciente={self.paciente.id}&fecha={fuera}", secure=True).data["cobro"])

    def test_sin_plus_recibe_403(self):
        self.user.suscripcion.plan = "estandar"
        self.user.suscripcion.save()
        lista = self.client.get(f"{URL}?sin_sesion=1", secure=True)
        self.assertEqual(lista.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(lista.data["code"], "requiere_plus")
        sugerencia = self.client.get(f"{URL}sugerencia/?paciente={self.paciente.id}&fecha=2026-10-13", secure=True)
        self.assertEqual(sugerencia.data["code"], "requiere_plus")

    def test_resumen_cuenta_cobros_sin_sesion(self):
        self.crear(sesiones=[])
        self.crear(sesiones=[self.sesion(1).id])
        datos = self.client.get(f"{URL}resumen/?mes=2026-10", secure=True).data
        self.assertEqual(datos["cobros_sin_sesion"], 1)
        self.assertEqual(datos["cobros_sin_sesion_paciente"], self.paciente.id)
        filas = self.client.get(f"{URL}?paciente={self.paciente.id}&sin_sesion=1", secure=True).data["results"]
        self.assertEqual(len(filas), 1)
        self.assertEqual(filas[0]["sesiones"], [])
