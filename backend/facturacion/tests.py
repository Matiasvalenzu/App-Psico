from datetime import date

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test import RequestFactory, TestCase
from rest_framework import serializers, status
from rest_framework.test import APITestCase

from pacientes.models import Paciente
from sesiones.models import Sesion

from .models import Cobro, ConfiguracionBHE, DelegacionSII, EmisionBHE
from .services import anulable_hasta, calcular_retencion, enmascarar_rut, validar_glosa

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

    def test_anonimo_recibe_401(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/facturacion/cobros/", secure=True).status_code, 401)
        self.assertEqual(self.client.post("/api/facturacion/cobros/", {}, format="json", secure=True).status_code, 401)

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

    def test_actualiza_el_receptor_si_la_ficha_cambio(self):
        cobro = self.crear().data
        url = f"{URL}{cobro['id']}/"
        self.assertFalse(cobro["receptor_desactualizado"])
        self.paciente.direccion, self.paciente.comuna = "Calle 2", "Providencia"
        self.paciente.save()
        self.assertTrue(self.client.get(url, secure=True).data["receptor_desactualizado"])
        response = self.client.post(f"{url}actualizar-receptor/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual((response.data["receptor_direccion"], response.data["receptor_comuna"]), ("Calle 2", "Providencia"))
        self.assertFalse(response.data["receptor_desactualizado"])

    def test_actualizar_receptor_de_menor_conserva_el_rut_del_tutor(self):
        menor = Paciente.objects.create(
            psicologo=self.user, nombre="Tomás", apellido="Rojas", es_menor_edad=True, nombre_tutor="Ana Rojas"
        )
        cobro = self.crear(paciente=menor.id, receptor_documento="12.345.678-5").data
        self.assertFalse(cobro["receptor_desactualizado"])
        menor.direccion = "Calle 3"
        menor.save()
        response = self.client.post(f"{URL}{cobro['id']}/actualizar-receptor/", secure=True)
        self.assertEqual((response.data["receptor_documento"], response.data["receptor_direccion"]), ("12.345.678-5", "Calle 3"))

    def test_no_actualiza_el_receptor_de_una_boleta_emitida(self):
        cobro = self.crear().data
        url = f"{URL}{cobro['id']}/"
        self.client.post(f"{url}marcar-emitida/", {"folio": "99"}, secure=True)
        self.paciente.direccion = "Calle 2"
        self.paciente.save()
        self.assertFalse(self.client.get(url, secure=True).data["receptor_desactualizado"])
        self.assertEqual(self.client.post(f"{url}actualizar-receptor/", secure=True).status_code, 400)
        self.assertEqual(Cobro.objects.get(id=cobro["id"]).receptor_direccion, "Calle 1")

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


def crear_cobro(psicologo, **extra):
    datos = {
        "psicologo": psicologo, "fecha_pago": date(2026, 10, 12), "monto_bruto": 250000,
        "tasa_retencion": "15.25", "monto_retencion": 38125, "monto_liquido": 211875,
        "receptor_documento": "11.111.111-1", "receptor_nombre": "Ana Rojas", "glosa": "Atención psicológica",
        **extra,
    }
    return Cobro.objects.create(**datos)


class EmisionBHEModeloTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="psi@psiconex.cl", email="psi@psiconex.cl", password="x")
        self.cobro = crear_cobro(self.user)

    def emision(self, tipo=EmisionBHE.Tipo.EMISION, **extra):
        clave = extra.pop("idempotency_key", None) or EmisionBHE.clave_idempotencia(self.cobro, tipo)
        return EmisionBHE.objects.create(cobro=self.cobro, tipo=tipo, idempotency_key=clave, **extra)

    def test_clave_idempotencia(self):
        self.assertEqual(EmisionBHE.clave_idempotencia(self.cobro, EmisionBHE.Tipo.EMISION), f"cobro:{self.cobro.pk}:v1")
        self.assertEqual(
            EmisionBHE.clave_idempotencia(self.cobro, EmisionBHE.Tipo.ANULACION), f"cobro:{self.cobro.pk}:anulacion:v1"
        )

    def test_una_sola_emision_activa_por_cobro(self):
        self.emision()
        for estado in EmisionBHE.ESTADOS_ACTIVOS:
            with self.subTest(estado=estado), self.assertRaises(IntegrityError), transaction.atomic():
                self.emision(idempotency_key=f"otra-{estado}", estado=estado)

    def test_tras_fallida_se_permite_otra(self):
        primera = self.emision()
        primera.estado = EmisionBHE.Estado.FALLIDA
        primera.save()
        self.cobro.version_emision += 1
        self.cobro.save()
        segunda = self.emision()
        self.assertEqual(segunda.idempotency_key, f"cobro:{self.cobro.pk}:v2")

    def test_anulacion_convive_con_emision_emitida(self):
        self.emision(estado=EmisionBHE.Estado.EMITIDA)
        self.emision(tipo=EmisionBHE.Tipo.ANULACION)
        self.assertEqual(self.cobro.emisiones.count(), 2)

    def test_idempotency_key_unica(self):
        self.emision(estado=EmisionBHE.Estado.FALLIDA)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.emision(estado=EmisionBHE.Estado.FALLIDA)

    def test_payload_cifrado_en_base(self):
        emision = self.emision(payload='{"receptor": "11.111.111-1"}')
        with connection.cursor() as cursor:
            cursor.execute("SELECT payload FROM facturacion_emisionbhe WHERE id = %s", [emision.pk])
            crudo = cursor.fetchone()[0]
        self.assertTrue(crudo.startswith("enc:"))
        emision.refresh_from_db()
        self.assertIn("11.111.111-1", emision.payload)


class DelegacionSIITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="psi@psiconex.cl", email="psi@psiconex.cl", password="x")

    def test_vencimiento_vacio_por_omision(self):
        # El SII no mostró fecha de vencimiento en la autorización real: no se inventa una.
        delegacion = DelegacionSII.objects.create(
            psicologo=self.user, rut_emisor="777819771", fecha_otorgada=date(2026, 10, 12)
        )
        self.assertIsNone(delegacion.fecha_vencimiento)
        self.assertEqual(delegacion.estado, DelegacionSII.Estado.NO_INICIADA)
        self.assertFalse(delegacion.piloto)

    def test_respeta_vencimiento_del_portal(self):
        delegacion = DelegacionSII.objects.create(
            psicologo=self.user, rut_emisor="777819771",
            fecha_otorgada=date(2026, 10, 12), fecha_vencimiento=date(2027, 9, 30),
        )
        self.assertEqual(delegacion.fecha_vencimiento, date(2027, 9, 30))

    def test_enmascarar_rut(self):
        self.assertEqual(enmascarar_rut("777819771"), "77.***.***-1")
        self.assertEqual(enmascarar_rut("12.345.678-k"), "12.***.***-K")
        self.assertEqual(enmascarar_rut("11111111"), "1.***.***-1")
        self.assertEqual(enmascarar_rut(""), "***")


class ConfiguracionBHETests(TestCase):
    def test_parte_pausada(self):
        # La fila la crea la migración.
        self.assertTrue(ConfiguracionBHE.objects.get(pk=1).pausada)
        self.assertTrue(ConfiguracionBHE.cola_pausada())

    def test_sin_fila_se_considera_pausada(self):
        ConfiguracionBHE.objects.all().delete()
        self.assertTrue(ConfiguracionBHE.cola_pausada())

    def test_singleton(self):
        config = ConfiguracionBHE(pausada=False)
        config.save()
        self.assertEqual(ConfiguracionBHE.objects.count(), 1)
        self.assertFalse(ConfiguracionBHE.cola_pausada())


class BHEAdminTests(TestCase):
    def setUp(self):
        self.request = RequestFactory().get("/")
        self.request.user = User(is_staff=True, is_superuser=True)

    def test_delegacion_rut_siempre_enmascarado(self):
        modelo_admin = admin.site._registry[DelegacionSII]
        campos = modelo_admin.get_fields(self.request)
        self.assertNotIn("rut_emisor", campos)
        self.assertIn("rut_enmascarado", campos)
        self.assertNotIn("rut_emisor", modelo_admin.list_display)

    def test_emision_sin_payload_ni_evidencias_y_solo_lectura(self):
        modelo_admin = admin.site._registry[EmisionBHE]
        campos = modelo_admin.get_fields(self.request)
        self.assertNotIn("payload", campos)
        self.assertNotIn("evidencias", campos)
        self.assertFalse(modelo_admin.search_fields)
        self.assertFalse(modelo_admin.has_change_permission(self.request))
        self.assertFalse(modelo_admin.has_add_permission(self.request))


class CobroEnEmisionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="psi@psiconex.cl", email="psi@psiconex.cl", password="x")
        self.user.suscripcion.plan = "plus"
        self.user.suscripcion.save()
        self.cobro = crear_cobro(self.user, estado_boleta=Cobro.EstadoBoleta.EN_EMISION)
        self.client.force_authenticate(user=self.user)

    def test_no_se_marca_emitida_a_mano(self):
        response = self.client.post(
            f"{URL}{self.cobro.id}/marcar-emitida/", {"folio": "123"}, format="json", secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "en_emision")

    def test_no_se_editan_campos_de_la_boleta(self):
        response = self.client.patch(f"{URL}{self.cobro.id}/", {"monto_bruto": 1000}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.patch(f"{URL}{self.cobro.id}/", {"notas": "ok"}, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_no_se_borra(self):
        response = self.client.delete(f"{URL}{self.cobro.id}/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Cobro.objects.filter(pk=self.cobro.pk).exists())
