from datetime import datetime

from django.utils import timezone
from rest_framework import status

from sesiones.models import Sesion

from .models import Cobro
from .tests import URL, CobroApiTests


class CobroSesionesTests(CobroApiTests):
    def sesion(self, numero, dia=13):
        return Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.user,
            numero_sesion=numero,
            fecha_hora_inicio=timezone.make_aware(datetime(2026, 10, dia, 11, 0)),
            estado=Sesion.Estado.COMPLETADO,
        )

    def test_alta_desde_sesion_queda_vinculada(self):
        sesion = self.sesion(4)
        response = self.crear(sesion=sesion.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["sesiones"], [sesion.id])
        self.assertEqual(response.data["sesiones_detalle"][0]["numero_sesion"], 4)
        self.assertFalse(response.data["glosa_incluye_sesion"])
        self.assertEqual(response.data["glosa"], "Atención psicológica")
        cobro = Cobro.objects.get(pk=response.data["id"])
        self.assertEqual(list(cobro.sesiones.values_list("id", flat=True)), [sesion.id])

    def test_fk_viejo_no_se_copia_al_vincular(self):
        sesion = self.sesion(2)
        cobro = Cobro.objects.get(pk=self.crear().data["id"])
        cobro.sesion = sesion
        cobro.save(update_fields=["sesion"])
        self.assertEqual(list(cobro.sesiones.all()), [])
        fila = self.client.get(f"/api/sesiones/?paciente={self.paciente.id}", secure=True).data["results"][0]
        self.assertEqual(fila["cobro"]["id"], cobro.id)

    def test_varias_sesiones_y_glosa_opcional(self):
        tres = self.sesion(3, 1)
        cuatro = self.sesion(4, 13)
        response = self.crear(sesiones=[cuatro.id, tres.id], glosa_incluye_sesion=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertCountEqual(response.data["sesiones"], [tres.id, cuatro.id])
        self.assertIsNone(response.data["sesion"])
        self.assertEqual(response.data["glosa"], "Atención psicológica, sesiones 3 (01/10/2026), 4 (13/10/2026)")
        chip = self.client.get(f"/api/sesiones/?paciente={self.paciente.id}", secure=True).data["results"]
        self.assertTrue(all(f["cobro"]["id"] == response.data["id"] for f in chip))

    def test_glosa_de_una_sesion(self):
        sesion = self.sesion(4)
        response = self.crear(sesion=sesion.id, glosa_incluye_sesion=True)
        self.assertEqual(response.data["glosa"], "Atención psicológica, sesión 4, 13/10/2026")

    def test_glosa_con_sesion_respeta_los_100_del_sii(self):
        sesion = self.sesion(4)
        response = self.crear(sesion=sesion.id, glosa_incluye_sesion=True, glosa="Atención psicológica " * 4)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("100", str(response.data))

    def test_boleta_emitida_no_cambia_la_glosa(self):
        sesion = self.sesion(4)
        cobro = Cobro.objects.get(pk=self.crear(sesion=sesion.id).data["id"])
        cobro.estado_boleta = Cobro.EstadoBoleta.EMITIDA
        cobro.boleta_folio = "83"
        cobro.save(update_fields=["estado_boleta", "boleta_folio"])
        response = self.client.patch(
            f"{URL}{cobro.id}/",
            {"glosa_incluye_sesion": True, "glosa": "Otra glosa"},
            format="json",
            secure=True,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        cobro.refresh_from_db()
        self.assertEqual(cobro.glosa, "Atención psicológica")
        self.assertFalse(cobro.glosa_incluye_sesion)

    def test_sesion_vinculada_no_cuenta_como_sin_cobro(self):
        sesion = self.sesion(1, 8)
        self.crear(sesiones=[sesion.id])
        datos = self.client.get(f"{URL}resumen/?mes=2026-10", secure=True).data
        self.assertEqual(datos["sesiones_sin_cobro"], 0)
