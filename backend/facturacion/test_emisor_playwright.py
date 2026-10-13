import re
from datetime import date
from unittest import mock, skipUnless
from urllib.parse import parse_qs, urlsplit

from django.test import SimpleTestCase, TestCase, override_settings

from .emisores import (
    DatosBoleta, ErrorAntesDeEnviar, ErrorCredencial, ErrorDespuesDeEnviar, ErrorNegocio, LineaBoleta, Receptor, Retencion,
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

    def test_leer_paso_4_y_comparar_con_el_archivo(self):
        src = "/IMT/pdf/bhe_12345678-81.html"
        self.assertEqual(robot.leer_paso_4(BOLETA, src), ("81", CODIGO))
        casos = {
            "paso_4_ilegible": [(BOLETA.replace(CODIGO, ""), src), (BOLETA, "/IMT/pdf/otra.html"),
                                (BOLETA + f" {CODIGO[:-1]}F", src)],
            "paso_4_inconsistente": [(BOLETA, src.replace("-81", "-82")), (BOLETA, src.replace("12345678", "12345679"))],
        }  # fmt: skip
        for codigo, pares in casos.items():
            for texto, archivo in pares:
                with self.subTest(codigo, archivo=archivo), self.assertRaises(ErrorDespuesDeEnviar) as ctx:
                    robot.leer_paso_4(texto, archivo)
                self.assertEqual(ctx.exception.codigo, codigo)

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
    "TMBEUS_BoletaHonorariosElectronica.cgi": """<p>Paso 4 de 4</p><p>BOLETA DE HONORARIOS ELECTRONICA</p>
        <iframe name="prueba" src="/IMT/pdf/bhe_12345678-81.html"></iframe><button>Ver Boleta</button>""",
    # El día con cero adelante y el mes en número, para que el robot use los valores del formulario.
    "TMBCOT_MenuConsultasTerceros.cgi": """<form method="post" action="TMBCOT_ConsultaBoletaPdf.cgi">
<select name="cbo_dia_boleta"><option value="">Día</option><option value="09">9</option><option value="13">13</option></select>
<select name="cbo_mes_boleta"><option value="">Mes</option><option value="10">Octubre</option></select>
<select name="cbo_anio_boleta"><option value="2026">2026</option></select></form>""",
}
CODIGO = "12345678000008112AB3"
# Como la del 13-10 (§K): folio en el recuadro, código bajo el código de barras, otros «N°» y números largos.
BOLETA = f"""BOLETA DE HONORARIOS ELECTRONICA\nN ° 81\nRUT: 12.345.678-5\nFecha: 13 de Octubre de 2026
    ATENCION PSICOLOGICA 250.000\nTotal Honorarios: $: 250.000\n{CODIGO}\nRes. Ex. N° 83 de 30/08/2004\n11202610131022"""
PDF = b"%PDF-1.4 boleta"
LOGIN = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html"
PASO_1 = "https://loa.sii.cl/cgi_IMT/TMBEUS_ValidaAutoriz.cgi?modo=1"


class PortalSimulado(robot.PlaywrightEmisor):
    def __init__(self, clave_ok=True, rut_autorizador="12345678", paso_3=None, paso_4=None, boleta=BOLETA, pdf=PDF):
        super().__init__()
        self.paso_3, self.paso_4, self.boleta = paso_3, paso_4, boleta
        self.pdfs = list(pdf) if isinstance(pdf, list) else [pdf]  # una respuesta por pedido; la última se repite
        self.valores = {
            "tras_login": PASO_1 + "&ok=1" if clave_ok else LOGIN, "rut_autorizador": rut_autorizador,
        }  # fmt: skip
        self.con_sesion = False
        self.pedidas, self.envios, self.urls = [], [], []

    def _nueva_pagina(self, navegador):
        contexto = navegador.new_context()
        contexto.route(re.compile(r"https://\w+\.sii\.cl/.*"), self._responder)
        return contexto.new_page()

    def _responder(self, route):
        pagina = route.request.url.split("?")[0].rsplit("/", 1)[-1]
        self.pedidas.append(pagina)
        self.urls.append(route.request.url)
        if route.request.post_data:
            self.envios.append(route.request.post_data)
        cookie = {}
        if pagina == "TMBEUS_ValidaAutoriz.cgi" and not self.con_sesion:
            # Sin sesión muestra el login (sin redirigir: un 302 se saltaría esta ruta e iría al SII real).
            if "ok=1" not in route.request.url:
                pagina = "IngresoRutClave.html"
            self.con_sesion = "ok=1" in route.request.url
            if self.con_sesion:
                cookie = {"set-cookie": "sesion=del-login; Path=/"}
        if pagina == "TMBCOT_ConsultaBoletaPdf.cgi":
            # Como el SII: solo la sesión que emitió baja el PDF.
            pdf = self.pdfs.pop(0) if len(self.pdfs) > 1 else self.pdfs[0]
            if pdf is None or "sesion=del-login" not in route.request.all_headers().get("cookie", ""):
                return route.fulfill(status=500, body="")
            return route.fulfill(content_type="application/pdf", body=pdf)
        html = PAGINAS.get(pagina, "<p>No encontrada</p>").format(**self.valores)
        if pagina == "bhe_12345678-81.html":
            html = self.boleta.replace("\n", "<br>")
        if pagina == "TMBEUS_ConfirmaTimbrajeUsu.cgi" and self.paso_3:
            html = self.paso_3
        if pagina == "TMBEUS_BoletaHonorariosElectronica.cgi" and self.paso_4 == "abortar":
            return route.abort()
        if pagina == "TMBEUS_BoletaHonorariosElectronica.cgi" and self.paso_4:
            html = self.paso_4
        route.fulfill(content_type="text/html; charset=utf-8", headers=cookie, body=f"<html><body>{html}</body></html>")


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
        evidencias = dict(resultado.evidencias)
        self.assertIn("04-paso-4-emitida.png", evidencias)
        self.assertIn(CODIGO.encode(), evidencias["04-paso-4-boleta.html"])

    def test_paso_4_que_no_calza_queda_despues_de_enviar(self):
        for boleta, codigo in ((BOLETA.replace(CODIGO, ""), "paso_4_ilegible"),
                               (BOLETA.replace("N ° 81", "N ° 82"), "paso_4_inconsistente")):  # fmt: skip
            emisor = PortalSimulado(boleta=boleta)
            with self.subTest(codigo), self.assertRaises(ErrorDespuesDeEnviar) as ctx:
                emisor.emitir(datos())
            self.assertEqual(ctx.exception.codigo, codigo)
            self.assertIn("04-paso-4-emitida.png", dict(emisor.evidencias))

    def test_sin_pdf_igual_queda_emitida(self):
        emisor = PortalSimulado(pdf=None)
        resultado = emisor.emitir(datos())
        self.assertEqual((resultado.folio, resultado.pdf), ("81", b""))
        self.assertEqual(emisor.pedidas.count("TMBCOT_ConsultaBoletaPdf.cgi"), 2)  # un solo reintento

    def test_pdf_con_la_sesion_que_emitio_y_un_reintento_sin_otro_login(self):
        emisor = PortalSimulado(pdf=[None, PDF])
        self.assertEqual(emisor.emitir(datos()).pdf, PDF)
        self.assertEqual(emisor.pedidas.count("TMBCOT_ConsultaBoletaPdf.cgi"), 2)
        self.assertEqual(sum(CLAVE in envio for envio in emisor.envios), 1)

    def test_rechazo_antes_de_emitir_no_envia(self):
        emisor = PortalSimulado(rut_autorizador="99999999")
        with self.assertRaises(ErrorNegocio):
            emisor.emitir(datos())
        self.assertFalse(emisor.enviado)
        self.assertNotIn("TMBEUS_BoletaHonorariosElectronica.cgi", emisor.pedidas)

    def consulta(self, emisor):
        return parse_qs(urlsplit([url for url in emisor.urls if "TMBCOT_ConsultaBoletaPdf" in url][-1]).query)

    def test_recupera_el_pdf_con_el_codigo_y_un_solo_login(self):
        emisor = PortalSimulado()
        self.assertEqual(emisor.recuperar_pdf(RUT_EMISOR, "81", "11.111.111-1", date(2026, 10, 9), CODIGO), PDF)
        self.assertEqual(self.consulta(emisor), {"origen": ["TERCEROS"], "txt_codigobarras": [CODIGO]})
        self.assertEqual(sum(CLAVE in envio for envio in emisor.envios), 1)
        self.assertEqual(emisor.pedidas.count("TMBCOT_ConsultaBoletaPdf.cgi"), 1)
        self.assertNotIn("TMBEUS_PresentaDatosBoleta.cgi", emisor.pedidas)

    def test_sin_codigo_usa_la_comprobacion_con_los_valores_del_formulario(self):
        emisor = PortalSimulado()
        self.assertEqual(emisor.recuperar_pdf(RUT_EMISOR, "81", "11.111.111-1", date(2026, 10, 9)), PDF)
        self.assertEqual(self.consulta(emisor), {
            "origen": ["TERCEROS"], "txt_nroboleta_comprobacion": ["81"],
            "txt_rutctr_comprobacion": ["12345678"], "txt_dvctr_comprobacion": ["5"],
            "txt_rutreceptor_comprobacion": ["11111111"], "txt_dvreceptor_comprobacion": ["1"],
            "cbo_dia_boleta": ["09"], "cbo_mes_boleta": ["10"], "cbo_anio_boleta": ["2026"],
        })  # fmt: skip
        self.assertEqual(sum(CLAVE in envio for envio in emisor.envios), 1)

    def test_fecha_que_no_ofrece_el_formulario_no_consulta(self):
        emisor = PortalSimulado()
        with self.assertRaises(ErrorAntesDeEnviar) as ctx:
            emisor.recuperar_pdf(RUT_EMISOR, "81", "11.111.111-1", date(2026, 10, 20))
        self.assertEqual(ctx.exception.codigo, "pantalla_desconocida")
        self.assertNotIn("TMBCOT_ConsultaBoletaPdf.cgi", emisor.pedidas)

    def test_recuperacion_fallida_no_reintenta(self):
        for pdf, error in ((None, ErrorAntesDeEnviar), (b"<html>No ha sido posible</html>", ErrorNegocio)):
            emisor = PortalSimulado(pdf=pdf)
            with self.subTest(error.__name__), self.assertRaises(error):
                emisor.recuperar_pdf(RUT_EMISOR, "81", "11.111.111-1", date(2026, 10, 9), CODIGO)
            self.assertEqual(emisor.pedidas.count("TMBCOT_ConsultaBoletaPdf.cgi"), 1)
            self.assertEqual(sum(CLAVE in envio for envio in emisor.envios), 1)

    def test_recuperacion_con_clave_rechazada_no_consulta(self):
        emisor = PortalSimulado(clave_ok=False)
        with self.assertRaises(ErrorCredencial):
            emisor.recuperar_pdf(RUT_EMISOR, "81", "11.111.111-1", date(2026, 10, 9), CODIGO)
        self.assertEqual(sum(CLAVE in envio for envio in emisor.envios), 1)
        self.assertNotIn("TMBCOT_ConsultaBoletaPdf.cgi", emisor.pedidas)

    def test_paso_4_que_no_llega_queda_despues_de_enviar(self):
        emisor = PortalSimulado(paso_4="abortar")
        with self.assertRaises(ErrorDespuesDeEnviar):
            emisor.emitir(datos())
        self.assertEqual(emisor.pedidas.count("TMBEUS_BoletaHonorariosElectronica.cgi"), 1)


@skipUnless(_hay_chromium(), "Sin Chromium: correr en la imagen bhe-dev (servicio worker-bhe).")
@override_settings(BHE_RUT_AUTORIZADO="76.543.210-3", BHE_SII_CLAVE=CLAVE)
@mock.patch.object(robot, "ESPERA_MS", 3000)
class ExplorarConsultasTests(TestCase):
    def test_un_login_y_bloquea_emision_y_anulacion(self):
        import tempfile
        from io import StringIO
        from pathlib import Path

        from django.core.management import call_command

        from .management.commands import bhe_explorar_consultas as comando

        portal = PortalSimulado()
        ordenes = (
            "ir https://loa.sii.cl/cgi_IMT/TMBEUS_BoletaHonorariosElectronica.cgi",
            "ir https://loa.sii.cl/cgi_IMT/TMBANU_PrevalidaAnulacion.cgi",
            "clic Confirmar Datos",
            "descargar https://loa.sii.cl/cgi_IMT/TMBCOT_ConsultaBoletaPdf.cgi?origen=TERCEROS",
            "ir https://loa.sii.cl/cgi_IMT/TMBCOC_MenuConsultasContrib.cgi\nver menu\nfin",
        )
        with tempfile.TemporaryDirectory() as tmp:
            for numero, orden in enumerate(ordenes, 1):
                (Path(tmp) / "ordenes").mkdir(exist_ok=True)
                (Path(tmp) / "ordenes" / f"{numero:02d}.txt").write_text(orden)
            salida = StringIO()
            with mock.patch.object(comando, "PlaywrightEmisor", lambda: portal), mock.patch.object(comando, "ESPERA_ORDEN_S", 15):
                call_command("bhe_explorar_consultas", salida=tmp, stdout=salida)
            capturas = sorted(p.name for p in Path(tmp).glob("explorar-*/*"))
        texto = salida.getvalue()
        self.assertEqual(texto.count("BLOQUEADA"), 2, texto)
        self.assertIn("clic prohibido", texto)
        self.assertIn(f"descarga: {len(PDF)} bytes, pdf=True", texto)
        self.assertEqual(sum(CLAVE in envio for envio in portal.envios), 1)
        self.assertFalse({"TMBEUS_BoletaHonorariosElectronica.cgi", "TMBANU_PrevalidaAnulacion.cgi"} & set(portal.pedidas))
        self.assertIn("TMBCOC_MenuConsultasContrib.cgi", portal.pedidas)
        self.assertIn("03-menu.png", capturas, texto)
