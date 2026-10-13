import re
from datetime import date
from unittest import mock, skipUnless

from django.test import SimpleTestCase, override_settings

from .emisores import (
    DatosBoleta, ErrorCredencial, ErrorDespuesDeEnviar, ErrorNegocio, LineaBoleta, Receptor, Retencion,
)  # fmt: skip
from .emisores import playwright as robot

RUT_EMISOR = "12.345.678-5"  # ficticios
CLAVE = "clave-de-prueba"


def datos(lineas=None, **receptor):
    return DatosBoleta(
        rut_emisor=RUT_EMISOR,
        receptor=Receptor(
            **{
                "rut": "11.111.111-1",
                "nombre": "Ana Rojas",
                "domicilio": "Calle 1",
                "region": "Metropolitana de Santiago",
                "comuna": "Ñuñoa",
                **receptor,
            }
        ),
        fecha=date(2026, 10, 13),
        retencion=Retencion.CONTRIBUYENTE,
        lineas=lineas or (LineaBoleta("Atención psicológica", 250000),),
    )


class ValidacionesTests(SimpleTestCase):
    def test_limites_del_formulario(self):
        robot.validar(datos())
        casos = {
            "demasiadas_prestaciones": datos(lineas=tuple(LineaBoleta(f"L{n}", 1000) for n in range(5))),
            "datos_largos": datos(nombre="x" * 51),
        }
        for codigo, valor in casos.items():
            with self.subTest(codigo), self.assertRaises(ErrorNegocio) as ctx:
                robot.validar(valor)
            self.assertEqual(ctx.exception.codigo, codigo)
        for malo in (datos(domicilio="x" * 101), datos(lineas=(LineaBoleta("x" * 101, 1),)),
                     datos(lineas=(LineaBoleta("Atención", 100_000_000),))):  # fmt: skip
            with self.assertRaises(ErrorNegocio):
                robot.validar(malo)

    def test_elegir_opcion_como_las_escribe_el_sii(self):
        regiones = [("", "Seleccione"), ("13", "REGION METROPOLITANA DE SANTIAGO"), ("14", "REGION DE LOS RIOS")]
        self.assertEqual(robot.elegir_opcion(regiones, "Metropolitana de Santiago"), "13")
        self.assertEqual(robot.elegir_opcion(regiones, "Los Ríos"), "14")
        self.assertEqual(robot.elegir_opcion([("1", "ÑUÑOA"), ("2", "SAN MIGUEL")], "Ñuñoa"), "1")
        self.assertEqual(robot.elegir_opcion([("1", "SANTIAGO"), ("2", "ESTACION CENTRAL")], "Santiago"), "1")
        with self.assertRaises(ErrorNegocio):
            robot.elegir_opcion(regiones, "Maule")
        with self.assertRaises(ErrorNegocio):  # «Region» está en todas
            robot.elegir_opcion(regiones, "Región")

    def test_vista_previa_en_mayusculas_sin_tildes(self):
        texto = "EMISOR 12.345.678-5 RECEPTOR 11.111.111-1 ATENCION PSICOLOGICA 250.000 Total Honorarios $ 250.000"
        robot.revisar_vista_previa(texto, datos())
        with self.assertRaises(ErrorNegocio) as ctx:
            robot.revisar_vista_previa(texto.replace("12.345.678-5", "76.543.210-3"), datos())
        self.assertIn("RUT del emisor", ctx.exception.detalle)

    def test_leer_paso_4_tal_cual(self):
        texto = "Boleta de Honorarios Electrónica N° 81\nFecha 13/10/2026 12:05\nCódigo: 12345678000008112AB3"
        self.assertEqual(robot.leer_paso_4(texto), ("81", "12345678000008112AB3"))
        for malo in ("Código: 12345678000008112AB3", "N° 81 N° 82 Código: 12345678000008112AB3", "N° 81"):
            with self.subTest(malo), self.assertRaises(ErrorDespuesDeEnviar):
                robot.leer_paso_4(malo)

    @override_settings(BHE_RUT_AUTORIZADO=" ", BHE_SII_CLAVE=CLAVE)
    def test_sin_rut_autorizado_ni_abre_el_navegador(self):
        emisor = robot.PlaywrightEmisor()
        with mock.patch.object(emisor, "_navegador") as navegador, self.assertRaises(ErrorCredencial) as ctx:
            emisor.vista_previa(datos())
        self.assertEqual(ctx.exception.codigo, "sin_rut_autorizado")
        navegador.assert_not_called()


# Portal simulado con los nombres de campos del mapa (§K); el HTML real es otro.
PAGINAS = {
    "1040-1287.html": """<button>Emitir boleta de honorarios electrónica</button>
        <a href="https://loa.sii.cl/cgi_IMT/TMBEUS_ValidaAutoriz.cgi?modo=1">Por usuario autorizado</a>
        <a href="https://loa.sii.cl/cgi_IMT/TMBEUS_ValidaAutoriz.cgi?modo=2">Por usuario autorizado con datos usados anteriormente</a>""",
    "IngresoRutClave.html": """<form method="post" action="{tras_login}">
        <input id="rutcntr" name="rutcntr"><input type="password" name="clave">
        <button id="bt_ingresar" type="submit">Ingresar</button></form>""",
    "TMBEUS_ValidaAutoriz.cgi": """<form method="post" action="TMBEUS_PresentaDatosBoleta.cgi">
        <input type="radio" name="OptTipoRetencion" value="RETRECEPTOR" checked>
        <input type="radio" name="OptTipoRetencion" value="RETCONTRIBUYENTE">
        <input type="submit" value="Continuar"></form>""",
    "TMBEUS_PresentaDatosBoleta.cgi": """<form method="post" action="TMBEUS_ConfirmaTimbrajeUsu.cgi">
        <input type="hidden" name="rut_autorizador" value="{rut_autorizador}">
        <input type="hidden" name="dv_autorizador" value="5">
        <input type="hidden" name="OptTipoRetencion" value="RETCONTRIBUYENTE">
        <select name="cbo_dia_boleta"><option>12</option><option value="13">13</option></select>
        <select name="cbo_mes_boleta"><option>Septiembre</option><option>Octubre</option></select>
        <select name="cbo_anio_boleta"><option>2026</option><option>2027</option></select>
        <input name="txt_rut_destinatario"><input name="txt_dv_destinatario">
        <input name="txt_nombres_destinatario"><input name="txt_domicilio_destinatario">
        <select name="cod_region" onchange="comunas()"><option value="">Seleccione</option>
          <option value="13">REGION METROPOLITANA DE SANTIAGO</option><option value="5">REGION DE VALPARAISO</option></select>
        <select name="cbo_comuna"><option value="">Seleccione Comuna</option></select>
        <input name="desc_prestacion_1"><input name="valor_prestacion_1">
        <input name="desc_prestacion_2"><input name="valor_prestacion_2">
        <input type="submit" name="CmdConfirmarDatos" value="Confirmar Datos"></form>
        <script>function comunas() {{ setTimeout(() => {{
          document.querySelector("select[name=cbo_comuna]").innerHTML +=
            '<option value="13120">ÑUÑOA</option><option value="13130">SAN MIGUEL</option>'; }}, 200); }}</script>""",
    "TMBEUS_ConfirmaTimbrajeUsu.cgi": """<p>EMISOR 12.345.678-5</p><p>RECEPTOR 11.111.111-1</p>
        <p>ATENCION PSICOLOGICA 250.000</p><p>Total Honorarios $ 250.000</p>
        <form method="post" action="TMBEUS_BoletaHonorariosElectronica.cgi">
        <input type="submit" value="Emitir Boleta de Honorarios Electrónica"></form>""",
    "TMBEUS_BoletaHonorariosElectronica.cgi": """<h2>Boleta de Honorarios Electrónica N° 81</h2>
        <p>Fecha 13/10/2026 12:05</p><p>Código: 12345678000008112AB3</p><button>Ver Boleta</button>""",
}
PDF = b"%PDF-1.4 boleta"
LOGIN = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html"
PASO_1 = "https://loa.sii.cl/cgi_IMT/TMBEUS_ValidaAutoriz.cgi?modo=1"


class PortalSimulado(robot.PlaywrightEmisor):
    def __init__(self, clave_ok=True, rut_autorizador="12345678", paso_3=None, paso_4=None, pdf=PDF):
        super().__init__()
        self.paso_3, self.paso_4, self.pdf = paso_3, paso_4, pdf
        self.valores = {"tras_login": PASO_1 + "&ok=1" if clave_ok else LOGIN, "rut_autorizador": rut_autorizador}
        self.con_sesion = False
        self.pedidas, self.envios = [], []

    def _nueva_pagina(self, navegador):
        contexto = navegador.new_context()
        contexto.route(re.compile(r"https://\w+\.sii\.cl/.*"), self._responder)
        return contexto.new_page()

    def _responder(self, route):
        pagina = route.request.url.split("?")[0].rsplit("/", 1)[-1]
        self.pedidas.append(pagina)
        if route.request.post_data:
            self.envios.append(route.request.post_data)
        if pagina == "TMBEUS_ValidaAutoriz.cgi" and not self.con_sesion:
            # Sin sesión muestra el login (sin redirigir: un 302 se saltaría esta ruta e iría al SII real).
            if "ok=1" not in route.request.url:
                pagina = "IngresoRutClave.html"
            self.con_sesion = "ok=1" in route.request.url
        if pagina == "TMBCOT_ConsultaBoletaPdf.cgi":
            if self.pdf is None:
                return route.fulfill(status=500, body="")
            return route.fulfill(content_type="application/pdf", body=self.pdf)
        html = PAGINAS.get(pagina, "<p>No encontrada</p>").format(**self.valores)
        if pagina == "TMBEUS_ConfirmaTimbrajeUsu.cgi" and self.paso_3:
            html = self.paso_3
        if pagina == "TMBEUS_BoletaHonorariosElectronica.cgi" and self.paso_4 == "abortar":
            return route.abort()
        if pagina == "TMBEUS_BoletaHonorariosElectronica.cgi" and self.paso_4:
            html = self.paso_4
        route.fulfill(content_type="text/html; charset=utf-8", body=f"<html><body>{html}</body></html>")


def _hay_chromium():
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            pw.chromium.launch().close()
        return True
    except Exception:
        return False


@skipUnless(_hay_chromium(), "Sin Chromium: correr en la imagen bhe-dev (servicio worker-bhe).")
@override_settings(BHE_RUT_AUTORIZADO="76.543.210-3", BHE_SII_CLAVE=CLAVE)
@mock.patch.object(robot, "ESPERA_MS", 3000)
class PortalSimuladoTests(SimpleTestCase):
    def test_llega_a_la_vista_previa_sin_emitir(self):
        emisor = PortalSimulado()
        evidencias = dict(emisor.vista_previa(datos()))

        self.assertNotIn("TMBEUS_BoletaHonorariosElectronica.cgi", emisor.pedidas)
        self.assertEqual(
            sorted(evidencias),
            ["01-login.html", "01-login.png", "02-paso-2.html", "02-paso-2.png",
             "03-paso-3-vista-previa.html", "03-paso-3-vista-previa.png"],
        )  # fmt: skip
        self.assertNotIn(CLAVE.encode(), evidencias["01-login.html"])
        paso_2 = emisor.envios[-1]
        for campo in ("cbo_dia_boleta=13", "cbo_mes_boleta=Octubre", "txt_rut_destinatario=11111111",
                      "txt_dv_destinatario=1", "cod_region=13", "cbo_comuna=13120", "valor_prestacion_1=250000"):  # fmt: skip
            self.assertIn(campo, paso_2)

    def test_clave_rechazada_un_solo_intento(self):
        emisor = PortalSimulado(clave_ok=False)
        with self.assertRaises(ErrorCredencial):
            emisor.vista_previa(datos())
        self.assertEqual(sum(CLAVE in envio for envio in emisor.envios), 1)
        self.assertNotIn("TMBEUS_PresentaDatosBoleta.cgi", emisor.pedidas)

    def test_emisor_distinto_no_confirma_datos(self):
        emisor = PortalSimulado(rut_autorizador="99999999")
        with self.assertRaises(ErrorNegocio) as ctx:
            emisor.vista_previa(datos())
        self.assertEqual(ctx.exception.codigo, "emisor_distinto")
        self.assertNotIn("TMBEUS_ConfirmaTimbrajeUsu.cgi", emisor.pedidas)

    def test_rechazo_del_sii_en_el_paso_3(self):
        emisor = PortalSimulado(paso_3="<h2>BOLETAS</h2><p>Sr. Contribuyente:<br>No se puede emitir la boleta ya que "
                                       "el rut del destinatario corresponde a una persona fallecida.</p>")  # fmt: skip
        with self.assertRaises(ErrorNegocio) as ctx:
            emisor.vista_previa(datos())
        self.assertEqual(ctx.exception.codigo, "rechazada_sii")
        self.assertTrue(ctx.exception.detalle.startswith("No se puede emitir"))
        self.assertTrue(ctx.exception.detalle.endswith("persona fallecida."))

    def test_emite_con_un_solo_envio_y_lee_el_paso_4(self):
        emisor = PortalSimulado()
        resultado = emisor.emitir(datos())

        self.assertEqual(emisor.pedidas.count("TMBEUS_BoletaHonorariosElectronica.cgi"), 1)
        self.assertEqual((resultado.folio, resultado.codigo_sii), ("81", "12345678000008112AB3"))
        self.assertEqual((resultado.monto_bruto, resultado.monto_retencion, resultado.monto_liquido), (250000, None, None))
        self.assertEqual(resultado.pdf, PDF)
        self.assertIn("04-paso-4-emitida.png", dict(resultado.evidencias))

    def test_paso_4_ilegible_queda_despues_de_enviar(self):
        emisor = PortalSimulado(paso_4="<p>Su boleta fue emitida.</p>")
        with self.assertRaises(ErrorDespuesDeEnviar) as ctx:
            emisor.emitir(datos())
        self.assertEqual(ctx.exception.codigo, "paso_4_ilegible")
        self.assertIn("04-paso-4-emitida.png", dict(emisor.evidencias))

    def test_sin_pdf_igual_queda_emitida(self):
        resultado = PortalSimulado(pdf=None).emitir(datos())
        self.assertEqual((resultado.folio, resultado.pdf), ("81", b""))

    def test_rechazo_antes_de_emitir_no_envia(self):
        emisor = PortalSimulado(rut_autorizador="99999999")
        with self.assertRaises(ErrorNegocio):
            emisor.emitir(datos())
        self.assertFalse(emisor.enviado)
        self.assertNotIn("TMBEUS_BoletaHonorariosElectronica.cgi", emisor.pedidas)

    def test_paso_4_que_no_llega_queda_despues_de_enviar(self):
        emisor = PortalSimulado(paso_4="abortar")
        with self.assertRaises(ErrorDespuesDeEnviar):
            emisor.emitir(datos())
        self.assertEqual(emisor.pedidas.count("TMBEUS_BoletaHonorariosElectronica.cgi"), 1)
