import os
import subprocess
import sys
import tempfile
from datetime import date

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from .emisores import (
    CausaAnulacion,
    DatosBoleta,
    ErrorAntesDeEnviar,
    ErrorDespuesDeEnviar,
    ErrorNegocio,
    LineaBoleta,
    Receptor,
    Retencion,
    get_emisor,
)
from .emisores.fake import FakeEmisor

RUT_EMISOR = "77.781.977-1"
FECHA = date(2026, 10, 12)


def datos(lineas=None, **extra):
    valores = {
        "rut_emisor": RUT_EMISOR,
        "receptor": Receptor(
            rut="11.111.111-1", nombre="Ana Rojas", domicilio="Calle 1", region="Metropolitana", comuna="Ñuñoa"
        ),
        "fecha": FECHA,
        "retencion": Retencion.CONTRIBUYENTE,
        "lineas": (LineaBoleta("Atención psicológica", 250000),) if lineas is None else lineas,
        **extra,
    }
    return DatosBoleta(**valores)


class DatosBoletaTests(SimpleTestCase):
    def test_monto_bruto_suma_lineas(self):
        boleta = datos(lineas=(LineaBoleta("Sesión 1", 30000), LineaBoleta("Sesión 2", 30000)))
        self.assertEqual(boleta.monto_bruto, 60000)

    def test_limites_de_lineas(self):
        with self.assertRaises(ValueError):
            datos(lineas=())
        with self.assertRaises(ValueError):
            datos(lineas=tuple(LineaBoleta(f"Sesión {i}", 1000) for i in range(11)))
        self.assertEqual(datos(lineas=tuple(LineaBoleta(f"S{i}", 1000) for i in range(10))).monto_bruto, 10000)

    def test_linea_invalida(self):
        with self.assertRaises(ValueError):
            datos(lineas=(LineaBoleta("Sesión", 0),))
        with self.assertRaises(ValueError):
            datos(lineas=(LineaBoleta("  ", 1000),))

    def test_retencion_valores_sii(self):
        self.assertEqual(set(Retencion.values), {"RETRECEPTOR", "RETCONTRIBUYENTE"})
        with self.assertRaises(ValueError):
            datos(retencion="RETENCION_POR_EMISOR")


class FakeEmisorTests(SimpleTestCase):
    def setUp(self):
        directorio = tempfile.TemporaryDirectory()
        self.addCleanup(directorio.cleanup)
        ajuste = override_settings(BHE_STORAGE_PATH=directorio.name)
        ajuste.enable()
        self.addCleanup(ajuste.disable)

    def buscar(self, monto=250000):
        return FakeEmisor().buscar(RUT_EMISOR, "111111111", FECHA, monto)

    def test_exito_devuelve_folio_montos_sii_y_pdf(self):
        resultado = FakeEmisor("exito").emitir(datos())
        self.assertEqual(resultado.folio, "1")
        self.assertEqual((resultado.monto_retencion, resultado.monto_liquido), (38125, 211875))
        self.assertTrue(resultado.pdf.startswith(b"%PDF"))
        self.assertEqual(FakeEmisor("exito").emitir(datos()).folio, "2")

    def test_error_negocio(self):
        with self.assertRaises(ErrorNegocio):
            FakeEmisor("error_negocio").emitir(datos())
        self.assertEqual(self.buscar(), [])

    def test_timeout_antes_de_enviar_no_emite(self):
        with self.assertRaises(ErrorAntesDeEnviar):
            FakeEmisor("timeout_antes").emitir(datos())
        self.assertEqual(self.buscar(), [])

    def test_caida_despues_queda_emitida_y_buscar_la_encuentra(self):
        with self.assertRaises(ErrorDespuesDeEnviar):
            FakeEmisor("caida_despues").emitir(datos())
        encontradas = self.buscar()
        self.assertEqual([b.folio for b in encontradas], ["1"])
        self.assertEqual(self.buscar(monto=1000), [])

    def test_caida_despues_con_demora_aparece_en_la_segunda_busqueda(self):
        with self.assertRaises(ErrorDespuesDeEnviar):
            FakeEmisor("caida_despues_demora").emitir(datos())
        self.assertEqual(self.buscar(), [])
        self.assertEqual(len(self.buscar()), 1)

    def test_caida_despues_sin_boleta(self):
        with self.assertRaises(ErrorDespuesDeEnviar):
            FakeEmisor("caida_despues_sin_boleta").emitir(datos())
        self.assertEqual(self.buscar(), [])
        self.assertEqual(self.buscar(), [])

    def test_buscar_devuelve_varias_si_son_iguales(self):
        FakeEmisor().emitir(datos())
        FakeEmisor().emitir(datos())
        self.assertEqual(len(self.buscar()), 2)

    def test_anular_con_causa(self):
        folio = FakeEmisor().emitir(datos()).folio
        with self.assertRaises(ErrorNegocio):
            FakeEmisor().anular(RUT_EMISOR, folio, "OTRA")
        FakeEmisor().anular(RUT_EMISOR, folio, CausaAnulacion.ERROR_DIGITACION)
        self.assertTrue(self.buscar()[0].anulada)
        with self.assertRaises(ErrorNegocio):
            FakeEmisor().anular(RUT_EMISOR, folio, CausaAnulacion.NO_PAGO)
        with self.assertRaises(ErrorNegocio):
            FakeEmisor().anular(RUT_EMISOR, "999", CausaAnulacion.NO_PAGO)

    def test_sin_delegacion(self):
        self.assertFalse(FakeEmisor("sin_delegacion").verificar_delegacion(RUT_EMISOR))
        self.assertTrue(FakeEmisor("exito").verificar_delegacion(RUT_EMISOR))
        with self.assertRaises(ErrorNegocio):
            FakeEmisor("sin_delegacion").emitir(datos())

    def test_escenario_desconocido(self):
        with self.assertRaises(ValueError):
            FakeEmisor("otro")


class GetEmisorTests(SimpleTestCase):
    @override_settings(BHE_BACKEND="fake", BHE_FAKE_ESCENARIO="exito")
    def test_fake(self):
        self.assertIsInstance(get_emisor(), FakeEmisor)

    def test_sin_backend_o_no_implementado(self):
        for backend in ("", "playwright", "otro"):
            with self.subTest(backend=backend), override_settings(BHE_BACKEND=backend):
                with self.assertRaises(ImproperlyConfigured):
                    get_emisor()

    def test_produccion_rechaza_fake(self):
        entorno = {**os.environ, "BHE_BACKEND": "fake", "FIELD_ENCRYPTION_KEYS": "x"}
        resultado = subprocess.run(
            [sys.executable, "-c", "import config.settings.production"],
            env=entorno, capture_output=True, text=True,
        )
        self.assertNotEqual(resultado.returncode, 0)
        self.assertIn("BHE_BACKEND=fake", resultado.stderr)
