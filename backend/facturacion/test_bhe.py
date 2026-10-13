import json
import tempfile
import threading
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core import mail
from django.db import connection
from django.test import RequestFactory, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from . import bhe
from .comunas import COMUNAS, REGIONES, buscar_comuna
from .emisores import ErrorDespuesDeEnviar, Retencion
from .emisores.fake import FakeEmisor
from .models import Cobro, ConfiguracionBHE, DelegacionSII, EmisionBHE
from .services import calcular_retencion

User = get_user_model()
Estado = EmisionBHE.Estado
RUT_EMISOR = "77.781.977-1"


def preparar_psicologo(username="psi@psiconex.cl"):
    user = User.objects.create_user(username=username, email=username, password="x")
    user.suscripcion.plan = "plus"
    user.suscripcion.save()
    DelegacionSII.objects.create(
        psicologo=user, rut_emisor=RUT_EMISOR, estado=DelegacionSII.Estado.ACTIVA, verificada=True, piloto=True
    )
    return user


def crear_cobro(psicologo, **extra):
    # Retención con la tasa de hoy, que es la fecha que lleva la boleta.
    tasa, retencion, liquido = calcular_retencion(250000, timezone.localdate())
    datos = {
        "psicologo": psicologo, "fecha_pago": timezone.localdate(), "monto_bruto": 250000,
        "tasa_retencion": tasa, "monto_retencion": retencion, "monto_liquido": liquido,
        "receptor_documento": "11.111.111-1", "receptor_nombre": "Ana Rojas",
        "receptor_direccion": "Irarrázaval 123", "receptor_comuna": "nunoa", "glosa": "Atención psicológica",
        **extra,
    }
    return Cobro.objects.create(**datos)


class EntornoBHE:
    """Flag encendido, emisor simulado con registro propio por test y la cola sin pausa."""

    def setUp(self):
        super().setUp()
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        ajustes = override_settings(
            BHE_AUTO_DISPONIBLE=True, BHE_BACKEND="fake", BHE_STORAGE_PATH=tmp.name, BHE_FAKE_ESCENARIO="exito"
        )
        ajustes.enable()
        self.addCleanup(ajustes.disable)
        ConfiguracionBHE.objects.update_or_create(pk=1, defaults={"pausada": False})
        self.encoladas = []
        self.busquedas = []
        for nombre, destino in (("_encolar", self.encoladas), ("_programar_busqueda", self.busquedas)):
            parche = mock.patch.object(bhe, nombre, side_effect=lambda *a, d=destino, **k: d.append((a, k)))
            parche.start()
            self.addCleanup(parche.stop)

    def escenario(self, nombre):
        return self.settings(BHE_FAKE_ESCENARIO=nombre)


class MotivoBloqueoTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()

    def test_habilitado(self):
        self.assertIsNone(bhe.motivo_bloqueo(self.user))

    def test_codigos(self):
        with self.settings(BHE_AUTO_DISPONIBLE=False):
            self.assertEqual(bhe.motivo_bloqueo(self.user), "bhe_no_disponible")
        ConfiguracionBHE.objects.update(pausada=True)
        self.assertEqual(bhe.motivo_bloqueo(self.user), "bhe_pausada")
        DelegacionSII.objects.update(estado=DelegacionSII.Estado.VENCIDA)
        self.assertEqual(bhe.motivo_bloqueo(self.user), "delegacion_inactiva")
        DelegacionSII.objects.update(piloto=False)
        self.assertEqual(bhe.motivo_bloqueo(self.user), "no_piloto")
        self.user.suscripcion.plan = "estandar"
        self.user.suscripcion.save()
        self.assertEqual(bhe.motivo_bloqueo(self.user), "plan_required")

    def test_por_vencer_sigue_vigente(self):
        DelegacionSII.objects.update(estado=DelegacionSII.Estado.POR_VENCER)
        self.assertIsNone(bhe.motivo_bloqueo(self.user))


class DatosDesdeCobroTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()

    def test_mapeo(self):
        datos = bhe.datos_desde_cobro(crear_cobro(self.user), RUT_EMISOR, timezone.localdate())
        self.assertEqual(datos.receptor.comuna, "Ñuñoa")
        self.assertEqual(datos.receptor.region, "Metropolitana de Santiago")
        self.assertEqual(datos.retencion, Retencion.CONTRIBUYENTE)
        self.assertEqual([(l.nombre, l.monto) for l in datos.lineas], [("Atención psicológica", 250000)])
        receptor_retiene = crear_cobro(self.user, bhe_modo=Cobro.ModoBoleta.RECEPTOR_RETIENE)
        self.assertEqual(
            bhe.datos_desde_cobro(receptor_retiene, RUT_EMISOR, timezone.localdate()).retencion, Retencion.RECEPTOR
        )

    def test_rechazos(self):
        casos = (
            ({"bhe_modo": Cobro.ModoBoleta.SIN_DATOS_RECEPTOR}, "receptor_incompleto"),
            ({"receptor_tipo_doc": "PASAPORTE"}, "receptor_incompleto"),
            ({"receptor_direccion": "  "}, "receptor_incompleto"),
            ({"receptor_documento": ""}, "receptor_incompleto"),
            ({"receptor_comuna": "Gotham"}, "comuna_desconocida"),
        )
        for extra, codigo in casos:
            with self.subTest(extra=extra), self.assertRaises(bhe.EmisionNoPermitida) as ctx:
                bhe.datos_desde_cobro(crear_cobro(self.user, **extra), RUT_EMISOR, timezone.localdate())
            self.assertEqual(ctx.exception.codigo, codigo)


class SolicitarEmisionTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)

    def test_crea_y_encola_al_confirmar(self):
        with self.captureOnCommitCallbacks(execute=True):
            emision = bhe.solicitar_emision(self.cobro, self.user)
            self.assertEqual(self.encoladas, [])
        self.assertEqual(self.encoladas, [((emision.pk,), {})])
        self.assertEqual(emision.estado, Estado.PENDIENTE)
        self.assertEqual(emision.idempotency_key, f"cobro:{self.cobro.pk}:v1")
        self.assertEqual(json.loads(emision.payload)["receptor"]["comuna"], "Ñuñoa")
        self.cobro.refresh_from_db()
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EN_EMISION)

    def test_doble_solicitud_devuelve_la_misma(self):
        with self.captureOnCommitCallbacks(execute=True):
            primera = bhe.solicitar_emision(self.cobro, self.user)
        with self.captureOnCommitCallbacks(execute=True):
            segunda = bhe.solicitar_emision(self.cobro, self.user)
        self.assertEqual(primera.pk, segunda.pk)
        self.assertEqual(len(self.encoladas), 1)

    def test_bloqueos(self):
        DelegacionSII.objects.update(piloto=False)
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            bhe.solicitar_emision(self.cobro, self.user)
        self.assertEqual(ctx.exception.codigo, "no_piloto")
        DelegacionSII.objects.update(piloto=True)
        emitido = crear_cobro(self.user, estado_boleta=Cobro.EstadoBoleta.EMITIDA, boleta_folio="7")
        with self.assertRaises(bhe.EmisionNoPermitida) as ctx:
            bhe.solicitar_emision(emitido, self.user)
        self.assertEqual(ctx.exception.codigo, "estado_invalido")
        self.assertFalse(EmisionBHE.objects.exists())


class ProcesarTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()
        self.cobro = crear_cobro(self.user)
        User.objects.create_superuser(username="admin", email="admin@psiconex.cl", password="x")

    def solicitar(self, cobro=None):
        with self.captureOnCommitCallbacks(execute=True):
            return bhe.solicitar_emision(cobro or self.cobro, self.user)

    def recargar(self, emision):
        emision.refresh_from_db()
        self.cobro.refresh_from_db()
        return emision

    def test_exito(self):
        emision = self.solicitar()
        bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual(emision.estado, Estado.EMITIDA)
        self.assertEqual((emision.folio, emision.codigo_sii, emision.intentos), ("1", "FAKE-1", 1))
        self.assertEqual(emision.error_codigo, "")
        self.assertEqual(emision.monto_retencion_sii, self.cobro.monto_retencion)
        self.assertEqual(emision.monto_liquido_sii, self.cobro.monto_liquido)
        self.assertTrue(emision.pdf.read().startswith(b"%PDF"))
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)
        self.assertEqual(self.cobro.boleta_folio, "1")
        self.assertEqual(self.cobro.boleta_fecha_emision, timezone.localdate())

    def test_segunda_ejecucion_no_hace_nada(self):
        emision = self.solicitar()
        bhe.procesar(emision.pk)
        with mock.patch.object(FakeEmisor, "emitir") as emitir:
            bhe.procesar(emision.pk)
        emitir.assert_not_called()

    def test_montos_distintos_queda_emitida_con_aviso(self):
        Cobro.objects.filter(pk=self.cobro.pk).update(monto_retencion=1, monto_liquido=249999)
        emision = self.solicitar()
        bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual(emision.estado, Estado.EMITIDA)
        self.assertEqual(emision.error_codigo, "montos_distintos")
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EMITIDA)

    def test_error_negocio_falla_y_permite_otro_intento(self):
        emision = self.solicitar()
        with self.escenario("error_negocio"):
            bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.error_codigo), (Estado.FALLIDA, "rechazada_sii"))
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.PENDIENTE)
        self.assertEqual(self.cobro.version_emision, 2)
        nueva = self.solicitar()
        self.assertNotEqual(nueva.pk, emision.pk)
        self.assertEqual(nueva.idempotency_key, f"cobro:{self.cobro.pk}:v2")

    def test_reintentos_antes_de_enviar_4_ejecuciones(self):
        emision = self.solicitar()
        self.encoladas.clear()
        with self.escenario("timeout_antes"):
            for _ in range(4):
                with self.captureOnCommitCallbacks(execute=True):
                    bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual([k["countdown"] for _, k in self.encoladas], [60, 300, 900])
        self.assertEqual((emision.estado, emision.intentos, emision.error_codigo), (Estado.FALLIDA, 4, "timeout"))
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.PENDIENTE)

    def test_credencial_rechazada_pausa_la_cola_sin_reintentar(self):
        emision = self.solicitar()
        otra = self.solicitar(crear_cobro(self.user))
        self.encoladas.clear()
        with self.escenario("credencial_rechazada"), self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.intentos), (Estado.PENDIENTE, 0))
        self.assertEqual(emision.error_codigo, "credencial_rechazada")
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EN_EMISION)
        self.assertEqual(self.encoladas, [])
        config = ConfiguracionBHE.objects.get()
        self.assertTrue(config.pausada)
        self.assertIn("clave", config.pausada_motivo)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["admin@psiconex.cl"])

        # Con la cola pausada nadie más toca el SII, y no se repite el aviso.
        with mock.patch.object(FakeEmisor, "emitir") as emitir:
            bhe.procesar(otra.pk)
        emitir.assert_not_called()
        bhe.pausar_por_credencial(SimpleNamespace(codigo="clave_rechazada"))
        self.assertEqual(len(mail.outbox), 1)

        bhe.reanudar_cola()
        self.assertCountEqual([a[0] for a, _ in self.encoladas], [emision.pk, otra.pk])

    def test_delegacion_revocada_antes_de_procesar(self):
        emision = self.solicitar()
        DelegacionSII.objects.update(estado=DelegacionSII.Estado.REVOCADA)
        bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.error_codigo), (Estado.FALLIDA, "delegacion_inactiva"))
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.PENDIENTE)

    def test_flag_apagado_deja_en_cola(self):
        emision = self.solicitar()
        with self.settings(BHE_AUTO_DISPONIBLE=False):
            bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.intentos), (Estado.PENDIENTE, 0))

    def test_error_inesperado_al_enviar_queda_por_confirmar(self):
        emision = self.solicitar()
        with mock.patch.object(FakeEmisor, "emitir", side_effect=RuntimeError("boom")), \
                self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.paso), (Estado.DESCONOCIDO, "BUSQUEDA_1"))
        self.assertEqual(emision.error_codigo, "error_inesperado")
        self.assertEqual(self.busquedas, [((emision.pk, 1), {})])

    def test_sin_busqueda_va_directo_a_revision_con_las_capturas(self):
        emision = self.solicitar()
        error = ErrorDespuesDeEnviar("paso_4_ilegible", "No se leyó el folio.")
        with mock.patch.object(FakeEmisor, "puede_buscar", False), \
                mock.patch.object(FakeEmisor, "evidencias", [("04-paso-4-emitida.png", b"png")], create=True), \
                mock.patch.object(FakeEmisor, "emitir", side_effect=error), \
                self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.paso), (Estado.DESCONOCIDO, bhe.REVISION_MANUAL))
        self.assertEqual(emision.error_codigo, "paso_4_ilegible")
        self.assertEqual([ruta.rsplit("/", 1)[-1] for ruta in emision.evidencias], ["04-paso-4-emitida.png"])
        self.assertEqual((self.busquedas, len(self.encoladas)), ([], 1))  # solo la de la solicitud
        self.assertEqual(len(mail.outbox), 1)

    def test_caida_despues_se_concilia_sin_reenviar(self):
        emision = self.solicitar()
        with self.escenario("caida_despues"), self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.paso), (Estado.DESCONOCIDO, "BUSQUEDA_1"))
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EN_EMISION)
        self.encoladas.clear()

        with mock.patch.object(FakeEmisor, "emitir") as emitir:
            bhe.conciliar(emision.pk, 1)
        emitir.assert_not_called()
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.folio), (Estado.EMITIDA, "1"))
        self.assertEqual(self.cobro.boleta_folio, "1")
        self.assertEqual(self.encoladas, [])

    def test_caida_despues_encontrada_en_segunda_busqueda(self):
        emision = self.solicitar()
        with self.escenario("caida_despues_demora"), self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        with self.captureOnCommitCallbacks(execute=True):
            bhe.conciliar(emision.pk, 1)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.paso), (Estado.DESCONOCIDO, "BUSQUEDA_2"))
        self.assertEqual(self.busquedas[-1], ((emision.pk, 2), {}))
        bhe.conciliar(emision.pk, 2)
        self.recargar(emision)
        self.assertEqual(emision.estado, Estado.EMITIDA)

    def test_no_encontrada_queda_en_revision_manual(self):
        emision = self.solicitar()
        with self.escenario("caida_despues_sin_boleta"):
            with self.captureOnCommitCallbacks(execute=True):
                bhe.procesar(emision.pk)
            with self.captureOnCommitCallbacks(execute=True):
                bhe.conciliar(emision.pk, 1)
            bhe.conciliar(emision.pk, 2)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.paso), (Estado.DESCONOCIDO, bhe.REVISION_MANUAL))
        self.assertEqual(emision.error_codigo, "no_encontrada")
        self.assertEqual(self.cobro.estado_boleta, Cobro.EstadoBoleta.EN_EMISION)
        self.assertEqual(len(mail.outbox), 1)
        # La revisión manual no se retoma sola.
        self.busquedas.clear()
        bhe.reanudar_cola()
        self.assertEqual(self.busquedas, [])

    def test_varias_coincidencias_queda_en_revision_manual(self):
        emision = self.solicitar()
        datos = bhe.datos_desde_payload(json.loads(emision.payload))
        FakeEmisor("exito").emitir(datos)
        FakeEmisor("exito").emitir(datos)
        with self.escenario("caida_despues_sin_boleta"), self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        bhe.conciliar(emision.pk, 1)
        self.recargar(emision)
        self.assertEqual((emision.paso, emision.error_codigo), (bhe.REVISION_MANUAL, "varias_coincidencias"))

    def test_conciliacion_ignora_folios_de_otros_cobros(self):
        emision = self.solicitar()
        datos = bhe.datos_desde_payload(json.loads(emision.payload))
        # Una boleta igual de otro cobro ya registrada con su folio.
        folio_ajeno = FakeEmisor("exito").emitir(datos).folio
        crear_cobro(self.user, estado_boleta=Cobro.EstadoBoleta.EMITIDA, boleta_folio=folio_ajeno)
        with self.escenario("caida_despues"), self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        bhe.conciliar(emision.pk, 1)
        self.recargar(emision)
        self.assertEqual((emision.estado, emision.folio), (Estado.EMITIDA, "2"))

    def test_conciliacion_respeta_pausa_y_credencial(self):
        emision = self.solicitar()
        with self.escenario("caida_despues"), self.captureOnCommitCallbacks(execute=True):
            bhe.procesar(emision.pk)
        ConfiguracionBHE.objects.update(pausada=True)
        bhe.conciliar(emision.pk, 1)
        self.assertEqual(self.recargar(emision).paso, "BUSQUEDA_1")
        ConfiguracionBHE.objects.update(pausada=False)
        with self.escenario("credencial_rechazada"):
            bhe.conciliar(emision.pk, 1)
        self.assertEqual(self.recargar(emision).paso, "BUSQUEDA_1")
        self.assertTrue(ConfiguracionBHE.cola_pausada())
        ConfiguracionBHE.objects.update(pausada=False)
        bhe.reanudar_cola()
        self.assertEqual(self.busquedas[-1], ((emision.pk, 1), {"countdown": 0}))


class RescateTests(EntornoBHE, TestCase):
    def setUp(self):
        super().setUp()
        self.user = preparar_psicologo()

    def en_curso(self, minutos, paso):
        cobro = crear_cobro(self.user, estado_boleta=Cobro.EstadoBoleta.EN_EMISION)
        return EmisionBHE.objects.create(
            cobro=cobro, idempotency_key=f"cobro:{cobro.pk}:v1", estado=Estado.EN_CURSO, paso=paso,
            intentos=1, started_at=timezone.now() - timedelta(minutes=minutos),
        )

    def test_rescate(self):
        enviando = self.en_curso(20, bhe.ANTES_SUBMIT)
        preparando = self.en_curso(20, "")
        reciente = self.en_curso(5, bhe.ANTES_SUBMIT)
        with self.captureOnCommitCallbacks(execute=True):
            bhe.rescatar_colgadas()
        for emision in (enviando, preparando, reciente):
            emision.refresh_from_db()
        self.assertEqual((enviando.estado, enviando.paso), (Estado.DESCONOCIDO, "BUSQUEDA_1"))
        self.assertEqual(self.busquedas, [((enviando.pk, 1), {"countdown": 0})])
        self.assertEqual(preparando.estado, Estado.PENDIENTE)
        self.assertEqual(self.encoladas, [((preparando.pk,), {})])
        self.assertEqual(reciente.estado, Estado.EN_CURSO)


class AdminReanudarTests(TestCase):
    def test_quitar_pausa_reanuda_la_cola(self):
        config, _ = ConfiguracionBHE.objects.get_or_create(pk=1)
        request = RequestFactory().post("/")
        request.user = User(is_superuser=True)
        config.pausada = False
        with mock.patch("facturacion.admin.reanudar_cola") as reanudar, \
                self.captureOnCommitCallbacks(execute=True):
            admin.site._registry[ConfiguracionBHE].save_model(
                request, config, SimpleNamespace(changed_data=["pausada"]), True
            )
        reanudar.assert_called_once()


class ComunasTests(TestCase):
    def test_tabla_completa(self):
        self.assertEqual(len(REGIONES), 16)
        self.assertEqual(sum(len(c) for c in COMUNAS.values()), 346)

    def test_buscar(self):
        for texto, nombre, region in (
            ("ÑUÑOA ", "Ñuñoa", "Metropolitana de Santiago"),
            ("Til Til", "Tiltil", "Metropolitana de Santiago"),
            ("La Calera", "Calera", "Valparaíso"),
            ("puerto natales", "Natales", "Magallanes y de la Antártica Chilena"),
            ("concepcion", "Concepción", "Biobío"),
        ):
            with self.subTest(texto=texto):
                comuna = buscar_comuna(texto)
                self.assertEqual((comuna.nombre_sii, comuna.region_sii), (nombre, region))
        self.assertIsNone(buscar_comuna("Gotham"))
        self.assertIsNone(buscar_comuna(""))


@override_settings(BHE_AUTO_DISPONIBLE=True, BHE_BACKEND="fake", BHE_FAKE_ESCENARIO="exito")
class ConcurrenciaTests(TransactionTestCase):
    def test_dos_workers_emiten_una_sola_vez(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        ConfiguracionBHE.objects.update_or_create(pk=1, defaults={"pausada": False})
        user = preparar_psicologo()
        cobro = crear_cobro(user)
        with mock.patch.object(bhe, "_encolar"), self.settings(BHE_STORAGE_PATH=tmp.name):
            emision = bhe.solicitar_emision(cobro, user)
            original = FakeEmisor.emitir
            llamadas = []

            def emitir_lento(emisor, datos):
                llamadas.append(1)
                time.sleep(0.3)
                return original(emisor, datos)

            barrera = threading.Barrier(2)

            def worker():
                try:
                    barrera.wait()
                    bhe.procesar(emision.pk)
                finally:
                    connection.close()

            with mock.patch.object(FakeEmisor, "emitir", emitir_lento):
                hilos = [threading.Thread(target=worker) for _ in range(2)]
                for hilo in hilos:
                    hilo.start()
                for hilo in hilos:
                    hilo.join()
        self.assertEqual(len(llamadas), 1)
        emision.refresh_from_db()
        self.assertEqual(emision.estado, Estado.EMITIDA)
