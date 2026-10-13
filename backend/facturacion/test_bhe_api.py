import tempfile
import threading
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.contrib import admin
from django.core.cache import cache
from django.db import connection
from django.test import RequestFactory, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from cuentas.services import get_or_create_profile

from . import bhe
from .emisores.fake import FakeEmisor
from .models import Cobro, ConfiguracionBHE, DelegacionSII, EmisionBHE
from .test_bhe import RUT_EMISOR, EntornoBHE, User, crear_cobro, preparar_psicologo

Estado = EmisionBHE.Estado


def emision_por_confirmar(cobro, usuario):
    emision = bhe.solicitar_emision(cobro, usuario)
    EmisionBHE.objects.filter(pk=emision.pk).update(estado=Estado.DESCONOCIDO, paso=bhe.REVISION_MANUAL)
    return emision


def emitir(cobro, usuario, test):
    with test.captureOnCommitCallbacks(execute=True):
        emision = bhe.solicitar_emision(cobro, usuario)
    bhe.procesar(emision.pk)
    cobro.refresh_from_db()
    return emision


class CancelarTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)

    def test_cancelar_emision_pendiente(self):
        emision = bhe.solicitar_emision(self.cobro, self.user)
        bhe.cancelar_emision(self.cobro)
        emision.refresh_from_db()
        self.cobro.refresh_from_db()
        self.assertEqual(emision.estado, Estado.CANCELADA)
        self.assertIsNotNone(emision.finished_at)
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.PENDIENTE)
        self.assertEqual(self.cobro.version_emision, 2)
        # Si el worker la toma después, no hace nada.
        bhe.procesar(emision.pk)
        emision.refresh_from_db()
        self.assertEqual(emision.estado, Estado.CANCELADA)
        nueva = bhe.solicitar_emision(self.cobro, self.user)
        self.assertEqual(nueva.idempotency_key, f"cobro:{self.cobro.pk}:v2")

    def test_no_cancela_una_en_curso(self):
        emision = bhe.solicitar_emision(self.cobro, self.user)
        EmisionBHE.objects.filter(pk=emision.pk).update(estado=Estado.EN_CURSO)
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            bhe.cancelar_emision(self.cobro)
        self.assertEqual(ctx.exception.codigo, "no_cancelable")
        self.cobro.refresh_from_db()
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EN_EMISION)



class ResolverManualTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.operador = User.objects.create_superuser(username="operador", email="op@psiconex.cl", password="x")
        self.cobro = crear_cobro(self.user)

    def resolver(self, emision, **datos):
        return bhe.resolver_manual(emision.pk, self.operador, **datos)

    def test_emision_hecha_con_folio(self):
        emision = emision_por_confirmar(self.cobro, self.user)
        self.resolver(emision, hecha=True, folio="555")
        emision.refresh_from_db()
        self.cobro.refresh_from_db()
        self.assertEqual(emision.estado, Estado.EMITIDA)
        self.assertEqual(emision.paso, "")
        self.assertEqual(emision.resuelta_por, self.operador)
        self.assertIsNotNone(emision.resuelta_at)
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)
        self.assertEqual(self.cobro.boleta_folio, "555")
        self.assertEqual(self.cobro.boleta_fecha_emision, timezone.localdate())

    def test_emision_hecha_sin_folio(self):
        emision = emision_por_confirmar(self.cobro, self.user)
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            self.resolver(emision, hecha=True)
        self.assertEqual(ctx.exception.codigo, "folio_requerido")

    def test_folio_ocupado(self):
        crear_cobro(self.user, estado_boleta=Cobro.EstadoBoleta.EMITIDA, boleta_folio="555")
        emision = emision_por_confirmar(self.cobro, self.user)
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            self.resolver(emision, hecha=True, folio="555")
        self.assertEqual(ctx.exception.codigo, "folio_ocupado")
        emision.refresh_from_db()
        self.assertEqual(emision.estado, Estado.DESCONOCIDO)

    def test_emision_no_hecha_libera_el_cobro(self):
        emision = emision_por_confirmar(self.cobro, self.user)
        self.resolver(emision, hecha=False)
        emision.refresh_from_db()
        self.cobro.refresh_from_db()
        self.assertEqual(emision.estado, Estado.FALLIDA)
        self.assertEqual(emision.error_codigo, "no_esta_en_sii")
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.PENDIENTE)
        self.assertEqual(self.cobro.version_emision, 2)

    def test_solo_por_confirmar(self):
        emision = bhe.solicitar_emision(self.cobro, self.user)
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            self.resolver(emision, hecha=True, folio="555")
        self.assertEqual(ctx.exception.codigo, "estado_invalido")

    def test_formulario_admin(self):
        emision = emision_por_confirmar(self.cobro, self.user)
        url = reverse("admin:facturacion_emisionbhe_resolver", args=[emision.pk])
        self.client.force_login(self.operador)
        self.assertContains(self.client.get(url), "¿Aparece en el SII?")
        respuesta = self.client.post(url, {"hecha": "si", "folio": "abc"})
        self.assertContains(respuesta, "El folio debe ser numérico.")
        respuesta = self.client.post(url, {"hecha": "si", "folio": "777"})
        self.assertRedirects(respuesta, reverse("admin:facturacion_emisionbhe_change", args=[emision.pk]))
        self.cobro.refresh_from_db()
        self.assertEqual(self.cobro.boleta_folio, "777")

    def test_formulario_solo_superusuario(self):
        emision = emision_por_confirmar(self.cobro, self.user)
        staff = User.objects.create_user(username="staff", email="staff@psiconex.cl", password="x", is_staff=True)
        self.client.force_login(staff)
        url = reverse("admin:facturacion_emisionbhe_resolver", args=[emision.pk])
        self.assertEqual(self.client.post(url, {"hecha": "no"}).status_code, 403)
        emision.refresh_from_db()
        self.assertEqual(emision.estado, Estado.DESCONOCIDO)


class ApiBHETests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def url(self, accion, cobro=None):
        return f"/api/facturacion/cobros/{(cobro or self.cobro).pk}/{accion}/"

    def test_emitir_exige_confirmacion(self):
        respuesta = self.client.post(self.url("emitir-sii"), {}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["code"], "confirmacion_requerida")
        self.assertFalse(self.cobro.emisiones.exists())

    def test_emitir(self):
        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        self.assertEqual(respuesta.status_code, 202)
        self.assertEqual(respuesta.data["estado_boleta"], Cobro.EstadoBoleta.EN_EMISION)
        self.assertEqual(respuesta.data["ultima_emision"]["estado"], Estado.PENDIENTE)
        self.assertEqual(len(self.encoladas), 1)
        # Repetir no crea otra emisión.
        self.assertEqual(self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json").status_code, 202)
        self.assertEqual(self.cobro.emisiones.count(), 1)

    def test_emitir_bloqueado(self):
        DelegacionSII.objects.filter(psicologo=self.user).update(piloto=False)
        respuesta = self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data["code"], "no_piloto")

    def test_emitir_cola_pausada(self):
        ConfiguracionBHE.objects.filter(pk=1).update(pausada=True)
        respuesta = self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data["code"], "bhe_pausada")

    def test_emitir_plan_estandar(self):
        self.user.suscripcion.plan = "estandar"
        self.user.suscripcion.save()
        respuesta = self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data["code"], "plan_required")

    def test_emitir_boleta_ya_emitida(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(estado_boleta=Cobro.EstadoBoleta.EMITIDA, boleta_folio="1")
        respuesta = self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["code"], "estado_invalido")

    def test_cobro_ajeno(self):
        otro = preparar_psicologo("otro@psiconex.cl")
        ajeno = crear_cobro(otro)
        for accion in ("emitir-sii", "anular-sii", "cancelar-sii"):
            self.assertEqual(self.client.post(self.url(accion, ajeno), {"confirmado": True}, format="json").status_code, 404)
        self.assertEqual(self.client.get(self.url("emisiones", ajeno)).status_code, 404)

    def test_cancelar(self):
        self.client.post(self.url("emitir-sii"), {"confirmado": True}, format="json")
        respuesta = self.client.post(self.url("cancelar-sii"))
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["estado_boleta"], Cobro.EstadoBoleta.PENDIENTE)
        self.assertEqual(respuesta.data["ultima_emision"]["estado"], Estado.CANCELADA)
        respuesta = self.client.post(self.url("cancelar-sii"))
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["code"], "no_cancelable")

    def test_historial_sin_datos_del_receptor(self):
        emision = emitir(self.cobro, self.user, self)
        EmisionBHE.objects.create(
            cobro=self.cobro,
            idempotency_key="prueba-error",
            estado=Estado.FALLIDA,
            error_codigo="error_interno",
            error_detalle="KeyError: 'Ana Rojas'",
            payload='{"receptor_nombre": "Ana Rojas"}',
        )
        respuesta = self.client.get(self.url("emisiones"))
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.data), 2)
        self.assertNotIn("Ana Rojas", str(respuesta.data))
        for fila in respuesta.data:
            self.assertNotIn("payload", fila)
            self.assertNotIn("evidencias", fila)
        self.assertEqual(respuesta.data[1]["id"], emision.pk)
        self.assertEqual(respuesta.data[1]["folio"], self.cobro.boleta_folio)

    def test_limite_por_minuto(self):
        for _ in range(10):
            self.assertEqual(self.client.post(self.url("emitir-sii"), {}, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url("emitir-sii"), {}, format="json").status_code, 429)


@override_settings(BHE_RUT_AUTORIZADO="77.781.977-1", BHE_AUTO_DISPONIBLE=True)
class DelegacionApiTests(TestCase):
    url = "/api/facturacion/delegacion/"

    def setUp(self):
        self.user = User.objects.create_user(username="nuevo@psiconex.cl", email="nuevo@psiconex.cl", password="x")
        self.user.suscripcion.plan = "plus"
        self.user.suscripcion.save()
        self.perfil = get_or_create_profile(self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def con_rut(self, rut="11.111.111-1"):
        self.perfil.rut_profesional = rut
        self.perfil.save()

    def test_sin_delegacion(self):
        respuesta = self.client.get(self.url)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["estado"], DelegacionSII.Estado.NO_INICIADA)
        self.assertEqual(respuesta.data["rut_autorizar"], "77.781.977-1")
        self.assertEqual(respuesta.data["consentimiento_version_vigente"], bhe.CONSENTIMIENTO_VERSION)
        self.assertTrue(respuesta.data["motivo_bloqueo"])

    def test_exige_aceptar(self):
        self.con_rut()
        respuesta = self.client.post(self.url, {"acepta": False}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(DelegacionSII.objects.exists())

    def test_usa_el_rut_del_perfil(self):
        self.con_rut()
        respuesta = self.client.post(self.url, {"acepta": True, "rut": "22.222.222-2"}, format="json")
        self.assertEqual(respuesta.status_code, 201)
        delegacion = DelegacionSII.objects.get(psicologo=self.user)
        self.assertEqual(delegacion.rut_emisor, "11.111.111-1")
        # Nunca queda activa sin que el operador la verifique en el SII.
        self.assertEqual(delegacion.estado, DelegacionSII.Estado.PENDIENTE_VERIFICACION)
        self.assertFalse(delegacion.verificada)
        self.assertEqual(delegacion.fecha_otorgada, timezone.localdate())
        self.assertEqual(delegacion.consentimiento_version, bhe.CONSENTIMIENTO_VERSION)
        self.assertIsNotNone(delegacion.consentimiento_at)

    def test_sin_rut_en_el_perfil_lo_pide_y_lo_fija(self):
        respuesta = self.client.post(self.url, {"acepta": True}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("rut", respuesta.data)
        self.assertEqual(self.client.post(self.url, {"acepta": True, "rut": "11111111-2"}, format="json").status_code, 400)
        respuesta = self.client.post(self.url, {"acepta": True, "rut": "111111111"}, format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.perfil.refresh_from_db()
        self.assertEqual(self.perfil.rut_profesional, "11.111.111-1")
        self.assertEqual(DelegacionSII.objects.get(psicologo=self.user).rut_emisor, "11.111.111-1")
        respuesta = self.client.patch("/api/cuenta/perfil/", {"rut_profesional": "22.222.222-2"}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("rut_profesional", respuesta.data)
        self.perfil.refresh_from_db()
        self.assertEqual(self.perfil.rut_profesional, "11.111.111-1")

    def test_rut_de_otra_cuenta(self):
        preparar_psicologo("otro@psiconex.cl")
        self.con_rut(RUT_EMISOR)
        respuesta = self.client.post(self.url, {"acepta": True}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("rut", respuesta.data)

    def test_fecha_futura(self):
        self.con_rut()
        manana = (timezone.localdate() + timedelta(days=1)).isoformat()
        respuesta = self.client.post(self.url, {"acepta": True, "fecha_otorgada": manana}, format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_delegacion_vigente(self):
        self.con_rut()
        DelegacionSII.objects.create(
            psicologo=self.user, rut_emisor="11.111.111-1", estado=DelegacionSII.Estado.ACTIVA, verificada=True
        )
        respuesta = self.client.post(self.url, {"acepta": True}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["code"], "delegacion_vigente")

    def test_vencida_se_renueva(self):
        self.con_rut()
        DelegacionSII.objects.create(
            psicologo=self.user, rut_emisor="11.111.111-1", estado=DelegacionSII.Estado.VENCIDA, verificada=True,
            fecha_otorgada=timezone.localdate() - timedelta(days=400),
        )
        self.assertEqual(self.client.post(self.url, {"acepta": True}, format="json").status_code, 201)
        delegacion = DelegacionSII.objects.get(psicologo=self.user)
        self.assertEqual(delegacion.estado, DelegacionSII.Estado.PENDIENTE_VERIFICACION)
        self.assertFalse(delegacion.verificada)
        self.assertIsNone(delegacion.fecha_vencimiento)

    def test_por_vencer_se_renueva(self):
        self.con_rut()
        DelegacionSII.objects.create(
            psicologo=self.user, rut_emisor="11.111.111-1", estado=DelegacionSII.Estado.POR_VENCER, verificada=True,
            fecha_otorgada=timezone.localdate() - timedelta(days=350),
            fecha_vencimiento=timezone.localdate() + timedelta(days=15),
        )
        self.assertEqual(self.client.post(self.url, {"acepta": True}, format="json").status_code, 201)
        delegacion = DelegacionSII.objects.get(psicologo=self.user)
        self.assertEqual(delegacion.estado, DelegacionSII.Estado.PENDIENTE_VERIFICACION)
        self.assertEqual(delegacion.fecha_otorgada, timezone.localdate())
        self.assertIsNone(delegacion.fecha_vencimiento)
        self.assertFalse(delegacion.verificada)

    def test_rut_libre_sin_delegacion(self):
        self.con_rut()
        respuesta = self.client.patch("/api/cuenta/perfil/", {"rut_profesional": "22.222.222-2"}, format="json")
        self.assertEqual(respuesta.status_code, 200)

    def test_operador_activa_al_verificar(self):
        self.con_rut()
        self.client.post(self.url, {"acepta": True}, format="json")
        delegacion = DelegacionSII.objects.get(psicologo=self.user)
        delegacion.verificada = True
        request = RequestFactory().post("/")
        request.user = User(is_superuser=True)
        admin.site._registry[DelegacionSII].save_model(
            request, delegacion, SimpleNamespace(changed_data=["verificada"]), True
        )
        delegacion.refresh_from_db()
        self.assertEqual(delegacion.estado, DelegacionSII.Estado.ACTIVA)
        self.assertIsNotNone(delegacion.verificada_at)


@override_settings(BHE_AUTO_DISPONIBLE=True, BHE_BACKEND="fake", BHE_FAKE_ESCENARIO="exito")
class CancelarCarreraTests(TransactionTestCase):
    """Cancelar y el worker compiten por la misma emisión: gana el primero que la bloquea."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        ajustes = override_settings(BHE_STORAGE_PATH=tmp.name)
        ajustes.enable()
        self.addCleanup(ajustes.disable)
        ConfiguracionBHE.objects.update_or_create(pk=1, defaults={"pausada": False})
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)
        with mock.patch.object(bhe, "_encolar"):
            self.emision = bhe.solicitar_emision(self.cobro, self.user)

    def competir(self, primero):
        """Corre el worker y la cancelación; `primero` se queda con el lock un rato antes de seguir."""
        con_lock = threading.Event()
        ahora = timezone.now
        errores = {}
        llamadas = []
        original = FakeEmisor.emitir

        def ahora_lento():
            # Tanto procesar como cancelar_emision piden la hora recién después de bloquear la emisión.
            if threading.current_thread().name == primero and not con_lock.is_set():
                con_lock.set()
                time.sleep(0.4)
            return ahora()

        def emitir_contado(emisor, datos):
            llamadas.append(1)
            return original(emisor, datos)

        def correr(nombre, funcion):
            try:
                if nombre != primero:
                    con_lock.wait(5)
                funcion()
            except bhe.EmisionNoPermitida as exc:
                errores[nombre] = exc.codigo
            finally:
                connection.close()

        tareas = {
            "worker": lambda: bhe.procesar(self.emision.pk),
            "cancelar": lambda: bhe.cancelar_emision(self.cobro),
        }
        with mock.patch("django.utils.timezone.now", ahora_lento), mock.patch.object(FakeEmisor, "emitir", emitir_contado):
            hilos = [threading.Thread(target=correr, args=(n, f), name=n) for n, f in tareas.items()]
            for hilo in hilos:
                hilo.start()
            for hilo in hilos:
                hilo.join()
        self.emision.refresh_from_db()
        self.cobro.refresh_from_db()
        return errores, llamadas

    def test_el_worker_la_toma_primero(self):
        errores, llamadas = self.competir("worker")
        self.assertEqual(errores, {"cancelar": "no_cancelable"})
        self.assertEqual(len(llamadas), 1)
        self.assertEqual(self.emision.estado, Estado.EMITIDA)
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)
        self.assertEqual(self.cobro.version_emision, 1)

    def test_la_cancelacion_llega_primero(self):
        errores, llamadas = self.competir("cancelar")
        self.assertEqual(errores, {})
        self.assertEqual(llamadas, [])
        self.assertEqual(self.emision.estado, Estado.CANCELADA)
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.PENDIENTE)
