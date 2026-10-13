"""T7c: explora en solo lectura las consultas del SII con UN login de la empresa.

Tras el login queda esperando órdenes en archivos (`<ordenes>/01.txt`, `02.txt`, ...), una por línea:
    ir <url> | descargar <url> | clic <texto> | clic_css <selector> | elegir <name> <texto> | escribir <name> <valor>
    | ver <nombre> | fin
`{rut_titular}`, `{rut_sin_dv}` y `{dv}` se reemplazan con el RUT de la delegación local (nunca se imprime).
Red de seguridad: se abortan las URL de los pasos 3 y 4 de la emisión y las de anulación, y se rechazan los clics
en «Confirmar», «Emitir» o «Anular». Si el SII vuelve a pedir login, se detiene: no hay segundo intento.
"""

import re
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from facturacion.emisores.playwright import PlaywrightEmisor, _rut_limpio
from facturacion.models import DelegacionSII

BLOQUEADAS = re.compile(r"TMBEUS_ConfirmaTimbrajeUsu|TMBEUS_BoletaHonorariosElectronica|TMBANU_", re.I)
CLIC_PROHIBIDO = re.compile(r"confirm|emitir|anula", re.I)
RUT = re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]?\b|\b[0-9A-F]{7,}\b")
ESPERA_ORDEN_S = 15 * 60

RESUMEN_JS = """() => {
  const txt = e => (e.innerText || e.value || e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
  return {
    titulo: document.title,
    texto: document.body ? document.body.innerText : '',
    filas: document.querySelectorAll('table tr').length,
    marcos: [...document.querySelectorAll('iframe, frame')].map(f => (f.getAttribute('src') || '').split('?')[0]),
    campos: [...document.querySelectorAll('input:not([type=hidden]), textarea')].map(i => `${i.name || i.id}:${i.type}`),
    selects: [...document.querySelectorAll('select')].map(s => `${s.name}(${s.options.length})`),
    botones: [...document.querySelectorAll('button, input[type=button], input[type=submit]')].map(txt),
    enlaces: [...document.querySelectorAll('a')].map(a => `${txt(a)} → ${(a.getAttribute('href') || '').split('?')[0]}`).slice(0, 40),
  };
}"""


def _enmascarar(texto):
    return RUT.sub("‹…›", texto)


class Command(BaseCommand):
    help = "Explora en solo lectura las consultas del SII (T7c), con un solo login y URL de emisión/anulación bloqueadas."

    def add_arguments(self, parser):
        parser.add_argument("--salida", help="Carpeta de capturas (por defecto BHE_STORAGE_PATH/pruebas).")
        parser.add_argument("--ordenes", help="Carpeta de órdenes (por defecto <salida>/ordenes).")

    def handle(self, *args, **opciones):
        base = Path(opciones["salida"] or Path(settings.BHE_STORAGE_PATH) / "pruebas")
        self.salida = base / timezone.now().strftime("explorar-%Y%m%d-%H%M%S")
        self.salida.mkdir(mode=0o700, parents=True, exist_ok=True)
        ordenes = Path(opciones["ordenes"] or base / "ordenes")
        rut = _rut_limpio(DelegacionSII.objects.values_list("rut_emisor", flat=True).first() or "")
        self.reemplazos = {"{rut_titular}": f"{rut[:-1]}-{rut[-1:]}", "{rut_sin_dv}": rut[:-1], "{dv}": rut[-1:]}
        self.bloqueadas = []
        emisor = self.emisor = PlaywrightEmisor()
        try:
            with emisor._navegador() as page:
                page.context.route(BLOQUEADAS, self._bloquear)
                emisor._abrir_paso_1(page)  # el único login
                self._ver(page, "despues-login")
                self._atender(page, ordenes)
        finally:
            self._guardar()
            self.stdout.write(f"Bloqueadas: {len(self.bloqueadas)}. Capturas: {self.salida} (borrarlas tras revisarlas)")

    def _bloquear(self, ruta):
        self.bloqueadas.append(ruta.request.url.split("?")[0])
        self.stdout.write(f"BLOQUEADA {ruta.request.url.split('?')[0]}")
        ruta.abort()

    def _atender(self, page, ordenes):
        numero, desde = 1, time.monotonic()
        while time.monotonic() - desde < ESPERA_ORDEN_S:
            archivo = ordenes / f"{numero:02d}.txt"
            if not archivo.exists():
                time.sleep(1)
                continue
            self.stdout.write(f"== orden {numero:02d}")
            for linea in archivo.read_text().splitlines():
                if not linea.strip():
                    continue
                if linea.strip() == "fin":
                    return
                try:
                    self._ejecutar(page, linea.strip())
                except Exception as exc:  # una orden fallida no cierra la sesión
                    self.stdout.write(f"ERROR en «{_enmascarar(linea)}»: {type(exc).__name__}: {_enmascarar(str(exc))[:300]}")
                    page.wait_for_load_state()  # tras un bloqueo carga chrome-error: esperar o corta el próximo «ir»
                    break
                if self.emisor._es_login(page):
                    self.stdout.write("El SII volvió a pedir login: se detiene sin reintentar.")
                    return
            self.stdout.write(f"== fin orden {numero:02d}")
            self.stdout.flush()
            numero, desde = numero + 1, time.monotonic()

    def _ejecutar(self, page, linea):
        orden, _, resto = linea.partition(" ")
        for marca, valor in self.reemplazos.items():
            resto = resto.replace(marca, valor)
        if orden in ("clic", "clic_css") and CLIC_PROHIBIDO.search(resto):
            raise ValueError("clic prohibido en la exploración")
        if orden == "ir":
            page.goto(resto)
        elif orden == "descargar":
            return self._descargar(page, resto)
        elif orden == "clic":
            page.get_by_text(re.compile(re.escape(resto), re.I)).first.click()
        elif orden == "clic_css":
            page.locator(resto).first.click()
        elif orden == "elegir":
            nombre, _, texto = resto.partition(" ")
            self.emisor._seleccionar(page, nombre, texto)
        elif orden == "escribir":
            nombre, _, valor = resto.partition(" ")
            page.locator(f"[name={nombre}]").first.fill(valor)
        elif orden == "ver":
            self._ver(page, resto)
        else:
            raise ValueError(f"orden desconocida: {orden}")
        page.wait_for_load_state()

    def _descargar(self, page, url):
        from playwright.sync_api import Error as ErrorPlaywright

        with page.expect_download() as descarga:
            try:
                page.goto(url)
            except ErrorPlaywright as exc:
                if "Download is starting" not in str(exc):
                    raise
        ruta = self.salida / f"descarga-{len(list(self.salida.glob('descarga-*'))) + 1:02d}"
        descarga.value.save_as(ruta)
        ruta.chmod(0o600)
        self.stdout.write(f"-- descarga: {ruta.stat().st_size} bytes, pdf={ruta.read_bytes().startswith(b'%PDF')}")

    def _ver(self, page, nombre):
        self.emisor._capturar(page, nombre)
        self._guardar()
        datos = page.evaluate(RESUMEN_JS)
        texto = datos.pop("texto")
        self.stdout.write(f"-- {nombre}: {page.url.split('?')[0]} «{datos.pop('titulo')}»")
        self.stdout.write(f"   sin_datos={'sin datos' in texto.lower()} filas={datos.pop('filas')}")
        folios = {folio: bool(re.search(rf"\b0*{folio}\b", texto)) for folio in (77, 78)}
        self.stdout.write(f"   menciona_77={folios[77]} menciona_78={folios[78]}")
        for clave, valores in datos.items():
            self.stdout.write(f"   {clave}: {_enmascarar(' | '.join(valores))}")
        self.stdout.flush()

    def _guardar(self):
        # Las capturas tienen datos reales: solo el dueño las lee; se borran tras revisarlas.
        for nombre, contenido in self.emisor.evidencias:
            (self.salida / nombre).write_bytes(contenido)
            (self.salida / nombre).chmod(0o600)
