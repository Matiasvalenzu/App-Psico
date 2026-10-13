from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from facturacion.bhe import datos_desde_cobro
from facturacion.emisores import ErrorEmisor
from facturacion.emisores.playwright import PlaywrightEmisor
from facturacion.models import Cobro
from facturacion.services import hoy_chile


class Command(BaseCommand):
    help = "Prueba en seco del robot del SII: llena la boleta de un cobro hasta la vista previa, sin emitir."

    def add_arguments(self, parser):
        parser.add_argument("--cobro", type=int, required=True)
        parser.add_argument("--rut-emisor", required=True, help="RUT del titular que autorizó a la cuenta.")
        parser.add_argument("--salida", help="Carpeta para las capturas (por defecto BHE_STORAGE_PATH/pruebas).")

    def handle(self, *args, **opciones):
        datos = datos_desde_cobro(Cobro.objects.get(pk=opciones["cobro"]), opciones["rut_emisor"], hoy_chile())
        base = Path(opciones["salida"] or Path(settings.BHE_STORAGE_PATH) / "pruebas")
        salida = base / timezone.now().strftime("%Y%m%d-%H%M%S")
        emisor = PlaywrightEmisor()
        try:
            emisor.vista_previa(datos)
            resultado = "Llegó a la vista previa sin emitir."
        except ErrorEmisor as exc:
            resultado = f"Se detuvo antes de emitir ({type(exc).__name__}): {exc}"
        finally:
            salida.mkdir(parents=True, exist_ok=True)
            for nombre, contenido in emisor.evidencias:
                (salida / nombre).write_bytes(contenido)
        self.stdout.write(f"{resultado}\nCapturas: {salida}")
