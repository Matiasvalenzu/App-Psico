import re
from datetime import date
from unittest import mock, skipUnless

from django.test import SimpleTestCase, override_settings

from .emisores import DatosBoleta, ErrorCredencial, ErrorNegocio, LineaBoleta, Receptor, Retencion
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


# Portal simulado con los nombres de campos del mapa (§K); el HTML real es otro.
PAGINAS = {
    "1040-1287.html": """<button>Emitir boleta de honorarios electrónica</button>
        <a href="{entrada}">Por usuario autorizado</a>
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
}
LOGIN = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html"
PASO_1 = "https://loa.sii.cl/cgi_IMT/TMBEUS_ValidaAutoriz.cgi?modo=1"


class PortalSimulado(robot.PlaywrightEmisor):
    def __init__(self, clave_ok=True, rut_autorizador="12345678"):
        super().__init__()
        self.valores = {"entrada": LOGIN, "tras_login": PASO_1 if clave_ok else LOGIN, "rut_autorizador": rut_autorizador}
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
        html = PAGINAS.get(pagina, "<p>No encontrada</p>").format(**self.valores)
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
        self.assertNotIn("TMBEUS_ValidaAutoriz.cgi", emisor.pedidas)

    def test_emisor_distinto_no_confirma_datos(self):
        emisor = PortalSimulado(rut_autorizador="99999999")
        with self.assertRaises(ErrorNegocio) as ctx:
            emisor.vista_previa(datos())
        self.assertEqual(ctx.exception.codigo, "emisor_distinto")
        self.assertNotIn("TMBEUS_ConfirmaTimbrajeUsu.cgi", emisor.pedidas)
