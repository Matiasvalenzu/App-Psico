"""Emisor real: maneja el portal del SII con Chromium (Playwright), como usuario autorizado.

Ruta según el mapa de pantallas (§K, folio 77 emitido a mano):
portal → «Por usuario autorizado» → paso 1 (retención) → paso 2 (datos) → paso 3 (vista previa)
→ «Emitir Boleta de Honorarios Electrónica» → paso 4 (folio y código).
Sin sesión, el enlace lleva al login de AUT2000 (mapeado en la prueba en seco de la T7a).
Desde el clic en «Emitir» cualquier falla es ErrorDespuesDeEnviar: la boleta pudo quedar emitida.
"""

import base64
import re
import unicodedata
from contextlib import contextmanager
from urllib.parse import urljoin

from django.conf import settings

from ..comunas import normalizar
from .base import (
    EmisorBHE,
    ErrorAntesDeEnviar,
    ErrorCredencial,
    ErrorDespuesDeEnviar,
    ErrorEmisor,
    ErrorNegocio,
    ResultadoEmision,
)

PORTAL = "https://www.sii.cl/servicios_online/1040-1287.html"
ESPERA_MS = 30_000
MESES = (
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)  # fmt: skip
BOTON_EMITIR = "Emitir Boleta de Honorarios Electrónica"
# El paso 2 trae 4 prestaciones visibles; las demás se agregan con JS y su numeración salta el 5.
MAX_PRESTACIONES = 4
MAX_MONTO = 99_999_999  # valor_prestacion tiene maxlength 8
CODIGO_SII = r"[0-9A-F]{18,22}"  # empieza con el RUT del titular sin DV; el resto no se interpreta (mapa §K.2)
MARCO_BOLETA = "iframe[name=prueba]"


def _rut_limpio(rut):
    return "".join(c for c in rut if c.isalnum()).upper()


def texto_plano(texto):
    """Mayúsculas, sin tildes ni puntos: así escribe el SII la vista previa."""
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sin_tildes.upper().replace(".", "")).strip()


def validar(datos):
    """Los límites del formulario del SII; mejor rechazar que truncar sin avisar."""
    if len(datos.lineas) > MAX_PRESTACIONES:
        raise ErrorNegocio("demasiadas_prestaciones", f"El robot llena hasta {MAX_PRESTACIONES} prestaciones.")
    receptor = datos.receptor
    if len(receptor.nombre) > 50:
        raise ErrorNegocio("datos_largos", "El nombre del receptor supera los 50 caracteres del SII.")
    if len(receptor.domicilio) > 100:
        raise ErrorNegocio("datos_largos", "El domicilio del receptor supera los 100 caracteres del SII.")
    for linea in datos.lineas:
        if len(linea.nombre) > 100:
            raise ErrorNegocio("datos_largos", "La glosa supera los 100 caracteres del SII.")
        if linea.monto > MAX_MONTO:
            raise ErrorNegocio("datos_largos", "El monto supera los 8 dígitos del SII.")


def elegir_opcion(opciones, texto):
    """El value de la opción [(value, texto)] que coincide con `texto` (el SII escribe «REGION DE ...»)."""
    buscado = normalizar(texto)
    exactas = [valor for valor, etiqueta in opciones if normalizar(etiqueta) == buscado]
    parciales = [valor for valor, etiqueta in opciones if buscado and buscado in normalizar(etiqueta)]
    elegidas = exactas or parciales
    if len(elegidas) != 1:
        raise ErrorNegocio("opcion_no_encontrada", f"El SII no tiene una opción única para «{texto}».")
    return elegidas[0]


def revisar_vista_previa(texto, datos):
    plano = texto_plano(texto)
    esperados = {
        "RUT del emisor": _rut_formateado(datos.rut_emisor),
        "RUT del receptor": _rut_formateado(datos.receptor.rut),
        "total": str(datos.monto_bruto),
        **{f"glosa {n}": texto_plano(linea.nombre) for n, linea in enumerate(datos.lineas, start=1)},
    }
    faltan = [nombre for nombre, valor in esperados.items() if valor not in plano]
    if faltan:
        raise ErrorNegocio("vista_previa_distinta", "La vista previa no muestra: " + ", ".join(faltan) + ".")


def _credenciales():
    rut, clave = settings.BHE_RUT_AUTORIZADO.strip(), settings.BHE_SII_CLAVE
    if not rut:
        raise ErrorCredencial("sin_rut_autorizado", "BHE_RUT_AUTORIZADO está vacío: no se intenta el login.")
    if not clave:
        raise ErrorCredencial("sin_clave", "BHE_SII_CLAVE está vacía: no se intenta el login.")
    return rut, clave


def leer_paso_4(texto, src):
    """Folio y código del paso 4, tal como los muestra la boleta (cada uno por su lado, sin deducir uno del otro).

    La boleta viene en un iframe: se lee su texto y se compara con el archivo del iframe, bhe_<RUT sin DV>-<folio>.html.
    """
    folios = set(re.findall(r"ELECTR[OÓ]NICA\s*N\s*[°º]\s*(\d+)", texto, re.I))  # no el «Res. Ex. N° 83»
    codigos = set(re.findall(rf"(?<![0-9A-Z])({CODIGO_SII})(?![0-9A-Z])", texto))  # el que va bajo el código de barras
    archivo = re.search(r"bhe_(\d{7,8})-(\d+)\.html", src or "")
    if len(folios) != 1 or len(codigos) != 1 or not archivo:
        raise ErrorDespuesDeEnviar("paso_4_ilegible", "No se leyó un folio y un código únicos en el paso 4.")
    folio, codigo = folios.pop(), codigos.pop()
    if int(folio) != int(archivo[2]) or not codigo.startswith(archivo[1]):
        raise ErrorDespuesDeEnviar("paso_4_inconsistente", "El folio o el código de la boleta no calzan con su archivo.")
    return folio, codigo


def _rut_formateado(rut):
    limpio = _rut_limpio(rut)
    return f"{limpio[:-1]}-{limpio[-1]}"


class PlaywrightEmisor(EmisorBHE):
    nombre = "playwright"
    # La sesión de la empresa ve «Sin Datos» en los informes del SII (mapa §K): no hay cómo buscar.
    puede_buscar = False

    def __init__(self):
        self.evidencias = []  # [(nombre de archivo, bytes)], también cuando falla
        self.dialogos = []
        self.enviado = False

    def vista_previa(self, datos):
        """Llena la boleta hasta la vista previa (paso 3) y sale sin emitir."""
        validar(datos)
        _credenciales()  # sin RUT o sin clave ni se abre el navegador
        with self._navegador() as page:
            self._llegar_a_vista_previa(page, datos)
        return self.evidencias

    def emitir(self, datos):
        validar(datos)
        _credenciales()
        with self._navegador() as page:
            self._llegar_a_vista_previa(page, datos)
            folio, codigo = self._paso_4(page)
            # Solo esta sesión puede bajar el PDF (con un login nuevo el SII lo rechaza): un reintento aquí mismo.
            pdf = self._descargar_pdf(page, codigo) or self._descargar_pdf(page, codigo)
        return ResultadoEmision(
            folio=folio,
            fecha=datos.fecha,
            rut_receptor=datos.receptor.rut,
            monto_bruto=datos.monto_bruto,
            # Con retención del emisor el SII no muestra retención ni líquido.
            monto_retencion=None,
            monto_liquido=None,
            codigo_sii=codigo,
            pdf=pdf,
            evidencias=tuple(self.evidencias),
        )

    def buscar(self, rut_emisor, rut_receptor, fecha, monto_bruto):
        raise NotImplementedError("La búsqueda llega en la T7c.")

    def verificar_delegacion(self, rut_emisor):
        raise NotImplementedError

    @contextmanager
    def _navegador(self):
        from playwright.sync_api import Error as ErrorPlaywright
        from playwright.sync_api import sync_playwright

        self.evidencias, self.dialogos, self.enviado = [], [], False
        with sync_playwright() as pw:
            navegador = pw.chromium.launch()
            try:
                page = self._nueva_pagina(navegador)
                page.set_default_timeout(ESPERA_MS)
                page.on("dialog", self._dialogo)
                try:
                    yield page
                except ErrorPlaywright as exc:
                    self._capturar(page, "error")
                    clase = ErrorDespuesDeEnviar if self.enviado else ErrorAntesDeEnviar
                    # Solo la primera línea: el call log de Playwright puede traer valores escritos.
                    raise clase("portal_sin_respuesta", str(exc).splitlines()[0]) from None
                except ErrorEmisor as exc:
                    self._capturar(page, "error")
                    if self.enviado and not isinstance(exc, ErrorDespuesDeEnviar):
                        raise ErrorDespuesDeEnviar(exc.codigo, exc.detalle) from None
                    raise
            finally:
                navegador.close()

    def _nueva_pagina(self, navegador):
        return navegador.new_context(locale="es-CL").new_page()

    def _dialogo(self, dialog):
        self.dialogos.append(dialog.message)
        dialog.dismiss()

    def _capturar(self, page, nombre):
        from playwright.sync_api import Error as ErrorPlaywright

        prefijo = f"{len(self.evidencias) // 2 + 1:02d}-{nombre}"
        try:
            self.evidencias.append((f"{prefijo}.png", page.screenshot(full_page=True)))
            self.evidencias.append((f"{prefijo}.html", page.content().encode()))
        except ErrorPlaywright:
            pass

    def _en(self, page, cgi, espera=None):
        from playwright.sync_api import TimeoutError as TimeoutPlaywright

        try:
            page.wait_for_url(re.compile(re.escape(cgi)), timeout=espera)
        except TimeoutPlaywright:
            raise ErrorAntesDeEnviar(
                "pantalla_desconocida", f"Se esperaba {cgi} y el portal mostró {page.url.split('?')[0]}."
            ) from None

    def _seleccionar(self, page, nombre, texto):
        select = page.locator(f"select[name={nombre}]")
        opciones = select.locator("option").evaluate_all("os => os.map(o => [o.value, o.textContent])")
        select.select_option(value=elegir_opcion(opciones, texto))

    def _llegar_a_vista_previa(self, page, datos):
        self._abrir_paso_1(page)
        self._paso_1(page, datos)
        self._paso_2(page, datos)
        self._paso_3(page, datos)

    def _abrir_paso_1(self, page):
        page.goto(PORTAL)
        # Los enlaces del menú son javascript:linkVisita(...) dentro de acordeones: hay que hacer clic.
        # «Por usuario autorizado» (modo=2 es «...con datos usados anteriormente»).
        enlace = page.locator("a[href*='TMBEUS_ValidaAutoriz.cgi?modo=1']")
        if not enlace.is_visible():  # si el acordeón ya está abierto, un clic lo cerraría
            page.get_by_role("button", name=re.compile("Emitir boleta de honorarios electr", re.I)).first.click()
        enlace.click()
        page.wait_for_load_state()
        if self._es_login(page):
            self._login(page)

    def _es_login(self, page):
        return "AUT2000" in page.url or page.locator("input[type=password]").count() > 0

    def _login(self, page):
        from playwright.sync_api import Error as ErrorPlaywright

        self._capturar(page, "login")  # antes de escribir: la captura nunca lleva la clave
        rut, clave = _credenciales()
        campo_rut = page.locator("input#rutcntr, input[name=rutcntr]")
        campo_clave = page.locator("input[type=password]")
        boton = page.locator("#bt_ingresar")
        if campo_rut.count() != 1 or campo_clave.count() != 1 or boton.count() != 1:
            raise ErrorAntesDeEnviar("login_desconocido", "El login del SII no tiene los campos esperados.")
        # Un solo intento: si algo falla después de enviar la clave se pausa la cola en vez de
        # reintentar, para no bloquear la clave de la empresa.
        try:
            campo_rut.fill(_rut_formateado(rut))
            campo_clave.fill(clave)
            boton.click()
            page.wait_for_url(lambda url: "AUT2000" not in url)
            page.wait_for_load_state()
        except ErrorPlaywright:
            pass
        if self._es_login(page):
            raise ErrorCredencial("clave_rechazada", "El SII no aceptó el RUT y la clave de la cuenta autorizada.")

    def _paso_1(self, page, datos):
        self._en(page, "TMBEUS_ValidaAutoriz.cgi")
        if "no tiene autorizadores" in texto_plano(page.locator("body").inner_text()).lower():
            raise ErrorNegocio("delegacion_inactiva", "La cuenta no tiene autorizadores vigentes en el SII.")
        page.locator(f"input[name=OptTipoRetencion][value={datos.retencion}]").check()
        page.get_by_role("button", name="Continuar").click()

    def _paso_2(self, page, datos):
        self._en(page, "TMBEUS_PresentaDatosBoleta.cgi")
        autorizador = page.locator("input[name=rut_autorizador]").input_value() + page.locator(
            "input[name=dv_autorizador]"
        ).input_value()
        if _rut_limpio(autorizador) != _rut_limpio(datos.rut_emisor):
            raise ErrorNegocio("emisor_distinto", "El portal ofrece emitir a nombre de otro contribuyente.")
        if page.locator("input[name=OptTipoRetencion]").input_value() != datos.retencion:
            raise ErrorAntesDeEnviar("retencion_distinta", "El paso 2 no quedó con la retención elegida.")

        self._seleccionar(page, "cbo_dia_boleta", f"{datos.fecha.day:02d}")
        self._seleccionar(page, "cbo_mes_boleta", MESES[datos.fecha.month - 1])
        self._seleccionar(page, "cbo_anio_boleta", str(datos.fecha.year))
        cuerpo, dv = _rut_formateado(datos.receptor.rut).split("-")
        page.locator("input[name=txt_rut_destinatario]").fill(cuerpo)
        page.locator("input[name=txt_dv_destinatario]").fill(dv)
        page.locator("input[name=txt_nombres_destinatario]").fill(datos.receptor.nombre)
        page.locator("input[name=txt_domicilio_destinatario]").fill(datos.receptor.domicilio)
        self._seleccionar(page, "cod_region", datos.receptor.region)
        # El JS del SII arma las comunas al cambiar la región.
        page.wait_for_function("() => document.querySelector('select[name=cbo_comuna]').options.length > 1")
        self._seleccionar(page, "cbo_comuna", datos.receptor.comuna)
        for numero, linea in enumerate(datos.lineas, start=1):
            page.locator(f"input[name=desc_prestacion_{numero}]").fill(linea.nombre)
            page.locator(f"input[name=valor_prestacion_{numero}]").fill(str(linea.monto))
        self._capturar(page, "paso-2")
        page.locator("input[name=CmdConfirmarDatos]").click()

    def _paso_3(self, page, datos):
        try:
            self._en(page, "TMBEUS_ConfirmaTimbrajeUsu.cgi")
        except ErrorAntesDeEnviar:
            if self.dialogos:
                raise ErrorNegocio("rechazada_sii", self.dialogos[-1]) from None
            raise
        self._capturar(page, "paso-3-vista-previa")
        texto = page.locator("body").inner_text()
        if page.get_by_role("button", name=BOTON_EMITIR).count() != 1:
            # El SII rechaza en esta misma URL, p. ej. «Sr. Contribuyente: ... persona fallecida».
            mensaje = " ".join(texto.split("Sr. Contribuyente:")[-1].split())[:300]
            raise ErrorNegocio("rechazada_sii", mensaje)
        revisar_vista_previa(texto, datos)

    def _paso_4(self, page):
        self.enviado = True  # antes del clic: si se cae justo ahí, igual pudo llegar al SII
        page.get_by_role("button", name=BOTON_EMITIR).click()  # un solo clic; el JS del SII lo deshabilita
        self._en(page, "TMBEUS_BoletaHonorariosElectronica.cgi", espera=ESPERA_MS * 2)
        # La boleta va en un iframe que el JS del SII escribe al cargar.
        marco = page.frame_locator(MARCO_BOLETA)
        marco.get_by_text(re.compile("Total Honorarios", re.I)).wait_for()
        self._capturar(page, "paso-4-emitida")
        boleta = page.frame(name="prueba")
        self.evidencias.append((f"{len(self.evidencias) // 2:02d}-paso-4-boleta.html", boleta.content().encode()))
        return leer_paso_4(boleta.locator("body").inner_text(), page.locator(MARCO_BOLETA).get_attribute("src"))

    def _descargar_pdf(self, page, codigo):
        """El PDF con la misma sesión. Si falla la boleta igual quedó emitida: el psicólogo lo sube desde la ficha."""
        from playwright.sync_api import Error as ErrorPlaywright

        url = urljoin(
            page.url,
            f"TMBCOT_ConsultaBoletaPdf.cgi?txt_codigobarras={codigo}&veroriginal=si&origen=OCTAVO&enviar=si",
        )
        try:
            # fetch desde la página: lleva las cookies de la sesión (y pasa por las rutas en los tests).
            contenido = page.evaluate(
                """async url => {
                    const r = await fetch(url, {credentials: "include"});
                    if (!r.ok) return "";
                    let s = "";
                    for (const b of new Uint8Array(await r.arrayBuffer())) s += String.fromCharCode(b);
                    return btoa(s);
                }""",
                url,
            )
        except ErrorPlaywright:
            return b""
        pdf = base64.b64decode(contenido or "")
        return pdf if pdf.startswith(b"%PDF") else b""
