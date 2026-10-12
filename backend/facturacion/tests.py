from datetime import date

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework import serializers, status
from rest_framework.test import APITestCase

from pacientes.models import Paciente
from sesiones.models import Sesion

from .models import Cobro
from .services import anulable_hasta, calcular_retencion, validar_glosa

User = get_user_model()
URL = "/api/facturacion/cobros/"


class RetencionTests(TestCase):
    def test_ejemplos_oficiales_sii_2026(self):
        for bruto, retencion in ((555555, 84722), (250000, 38125), (150000, 22875)):
            tasa, ret, liquido = calcular_retencion(bruto, date(2026, 5, 1))
            self.assertEqual(ret, retencion)
            self.assertEqual(liquido, bruto - retencion)
            self.assertEqual(str(tasa), "15.25")

    def test_tasa_por_anio(self):
        self.assertEqual(calcular_retencion(100000, date(2027, 1, 1))[1], 16000)
        self.assertEqual(calcular_retencion(100000, date(2028, 12, 31))[1], 17000)

    def test_anio_sin_tasa(self):
        with self.assertRaises(serializers.ValidationError):
            calcular_retencion(100000, date(2029, 1, 1))

    def test_anulable_hasta(self):
        self.assertEqual(anulable_hasta(date(2026, 10, 25)), date(2026, 11, 10))
        self.assertEqual(anulable_hasta(date(2026, 12, 1)), date(2027, 1, 10))

    def test_glosa_rechaza_diagnosticos(self):
        for glosa in ("Atención F32", "Tratamiento trastorno depresivo", "Terapia TOC", "F41.1", "Ansiedad generalizada"):
            with self.assertRaises(serializers.ValidationError, msg=glosa):
                validar_glosa(glosa)

    def test_glosa_generica_permitida(self):
        for glosa in ("Atención psicológica", "Sesión de psicoterapia individual", "Protocolo de evaluación"):
            self.assertEqual(validar_glosa(glosa), glosa)


class CobroApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="psi@psiconex.cl", email="psi@psiconex.cl", password="x")
        self.user.suscripcion.plan = "plus"
        self.user.suscripcion.save()
        self.paciente = Paciente.objects.create(
            psicologo=self.user, nombre="Ana", apellido="Rojas", tipo_documento="RUT",
            numero_documento="111111111", direccion="Calle 1", comuna="Ñuñoa",
            motivo_consulta="Trastorno depresivo mayor F32",
        )
        self.client.force_authenticate(user=self.user)

    def crear(self, **extra):
        datos = {"paciente": self.paciente.id, "fecha_pago": "2026-10-12", "monto_bruto": 250000, **extra}
        return self.client.post(URL, datos, format="json", secure=True)

    def test_crea_cobro_con_snapshot_y_retencion(self):
        response = self.crear()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["receptor_documento"], "11.111.111-1")
        self.assertEqual(response.data["receptor_nombre"], "Ana Rojas")
        self.assertEqual(response.data["monto_retencion"], 38125)
        self.assertEqual(response.data["monto_liquido"], 211875)
        self.assertEqual(response.data["bhe_modo"], "RETENCION_POR_EMISOR")

    def test_glosa_nunca_sale_del_motivo_de_consulta(self):
        response = self.crear()
        self.assertEqual(response.data["glosa"], "Atención psicológica")
        self.assertNotIn("F32", response.data["glosa"])

    def test_glosa_usa_default_del_perfil(self):
        perfil = self.user.perfil_psicologo
        perfil.bhe_glosa_default = "Psicoterapia"
        perfil.save()
        self.assertEqual(self.crear().data["glosa"], "Psicoterapia")

    def test_glosa_con_diagnostico_rechazada(self):
        response = self.crear(glosa="Tratamiento F32")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("glosa", response.data)

    def test_glosa_default_perfil_con_diagnostico_rechazada(self):
        response = self.client.patch(
            "/api/cuenta/perfil/", {"bhe_glosa_default": "Trastorno depresivo"}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_desde_sesion_toma_el_paciente(self):
        sesion = Sesion.objects.create(paciente=self.paciente, psicologo=self.user)
        response = self.client.post(
            URL, {"sesion": sesion.id, "fecha_pago": "2026-10-12", "monto_bruto": 30000}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["paciente"], self.paciente.id)
        self.assertEqual(self.client.get(f"{URL}?sesion={sesion.id}", secure=True).data["results"][0]["id"], response.data["id"])

    def test_aislamiento_entre_psicologos(self):
        cobro_id = self.crear().data["id"]
        otro = User.objects.create_user(username="otro@psiconex.cl", email="otro@psiconex.cl", password="x")
        otro.suscripcion.plan = "plus"
        otro.suscripcion.save()
        self.client.force_authenticate(user=otro)
        self.assertEqual(self.client.get(URL, secure=True).data["results"], [])
        self.assertEqual(self.client.get(f"{URL}{cobro_id}/", secure=True).status_code, 404)
        response = self.client.post(
            URL, {"paciente": self.paciente.id, "fecha_pago": "2026-10-12", "monto_bruto": 1000}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_plan_estandar_lee_pero_no_escribe(self):
        cobro_id = self.crear().data["id"]
        self.user.suscripcion.plan = "estandar"
        self.user.suscripcion.save()
        self.assertEqual(self.client.get(URL, secure=True).status_code, 200)
        response = self.crear()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_required")
        self.assertEqual(
            self.client.post(f"{URL}{cobro_id}/marcar-emitida/", {"folio": "1"}, secure=True).status_code, 403
        )

    def test_menor_requiere_rut_del_tutor_para_emitir(self):
        menor = Paciente.objects.create(
            psicologo=self.user, nombre="Tomás", apellido="Rojas", es_menor_edad=True, nombre_tutor="Ana Rojas"
        )
        response = self.client.post(
            URL, {"paciente": menor.id, "fecha_pago": "2026-10-12", "monto_bruto": 30000}, format="json", secure=True
        )
        self.assertEqual(response.data["receptor_nombre"], "Ana Rojas")
        self.assertEqual(response.data["receptor_documento"], "")
        url = f"{URL}{response.data['id']}/"
        emitir = self.client.post(f"{url}marcar-emitida/", {"folio": "15"}, secure=True)
        self.assertEqual(emitir.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(emitir.data["detail"], "Falta el RUT del tutor/receptor.")
        self.client.patch(url, {"receptor_documento": "12.345.678-5"}, format="json", secure=True)
        emitir = self.client.post(f"{url}marcar-emitida/", {"folio": "15", "fecha_emision": "2026-10-12"}, secure=True)
        self.assertEqual(emitir.status_code, status.HTTP_200_OK, emitir.data)
        self.assertEqual(emitir.data["estado_boleta"], "EMITIDA")
        self.assertEqual(emitir.data["anulable_hasta"], date(2026, 11, 10))

    def test_rut_invalido_rechazado(self):
        response = self.crear(receptor_documento="12.345.678-9")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_emitida_bloquea_cambios_y_se_puede_anular(self):
        cobro = self.crear().data
        url = f"{URL}{cobro['id']}/"
        self.client.post(f"{url}marcar-emitida/", {"folio": "99"}, secure=True)
        self.assertEqual(self.client.patch(url, {"monto_bruto": 1}, format="json", secure=True).status_code, 400)
        self.assertEqual(self.client.delete(url, secure=True).status_code, 400)
        anular = self.client.post(f"{url}marcar-anulada/", secure=True)
        self.assertEqual(anular.data["estado_boleta"], "ANULADA")

    def test_snapshot_intacto_al_borrar_paciente(self):
        cobro_id = self.crear().data["id"]
        self.paciente.delete()
        cobro = Cobro.objects.get(id=cobro_id)
        self.assertIsNone(cobro.paciente)
        self.assertEqual(cobro.receptor_nombre, "Ana Rojas")
        self.assertEqual(str(cobro), f"Cobro #{cobro_id} - 2026-10-12")


class CobroAdminTests(TestCase):
    def test_receptor_oculto_para_staff_no_superusuario(self):
        modelo_admin = admin.site._registry[Cobro]
        request = RequestFactory().get("/")
        request.user = User(is_staff=True, is_superuser=False)
        campos = modelo_admin.get_fields(request)
        self.assertFalse(any(c.startswith("receptor_") for c in campos))
        self.assertNotIn("glosa", campos)
        request.user = User(is_staff=True, is_superuser=True)
        self.assertIn("receptor_documento", modelo_admin.get_fields(request))
        self.assertFalse(any(c.startswith("receptor_") for c in modelo_admin.list_display))
        self.assertFalse(modelo_admin.search_fields)
