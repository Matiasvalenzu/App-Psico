"""Emisor simulado para desarrollo y tests. Nunca toca el SII.

El escenario se elige con BHE_FAKE_ESCENARIO. Lo "emitido" queda en un JSON dentro de
BHE_STORAGE_PATH para que `buscar` funcione entre procesos, igual que el portal real.
"""

import fcntl
import json
from contextlib import contextmanager
from datetime import date
from pathlib import Path

from django.conf import settings

from ..services import calcular_retencion
from .base import (
    CausaAnulacion,
    EmisorBHE,
    ErrorAntesDeEnviar,
    ErrorCredencial,
    ErrorDespuesDeEnviar,
    ErrorNegocio,
    ResultadoEmision,
)

ESCENARIOS = (
    "exito",
    "error_negocio",  # el SII rechaza la boleta
    "timeout_antes",  # el portal no responde antes de enviar
    "caida_despues",  # se envió y quedó emitida, pero el robot cayó
    "caida_despues_demora",  # igual, pero la primera búsqueda todavía no la encuentra
    "caida_despues_sin_boleta",  # el robot cayó y la boleta no quedó emitida
    "sin_delegacion",  # el psicólogo no autorizó o revocó la delegación
    "credencial_rechazada",  # el SII rechaza la clave de la cuenta autorizada
)


def _rut(valor):
    return "".join(c for c in (valor or "") if c.isalnum()).upper()


def _pdf_simulado(folio):
    texto = f"BOLETA SIMULADA - folio {folio} - sin validez tributaria"
    contenido = f"BT /F1 14 Tf 40 760 Td ({texto}) Tj ET".encode()
    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(contenido), contenido),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    salida = bytearray(b"%PDF-1.4\n")
    offsets = []
    for numero, objeto in enumerate(objetos, start=1):
        offsets.append(len(salida))
        salida += b"%d 0 obj\n%s\nendobj\n" % (numero, objeto)
    inicio_xref = len(salida)
    salida += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    for offset in offsets:
        salida += b"%010d 00000 n \n" % offset
    salida += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, inicio_xref)
    return bytes(salida)


class FakeEmisor(EmisorBHE):
    nombre = "fake"

    def __init__(self, escenario=None):
        self.escenario = escenario or settings.BHE_FAKE_ESCENARIO
        if self.escenario not in ESCENARIOS:
            raise ValueError(f"Escenario desconocido: {self.escenario}")

    @contextmanager
    def _registro(self):
        ruta = Path(settings.BHE_STORAGE_PATH) / "fake-sii" / "registro.json"
        ruta.parent.mkdir(parents=True, exist_ok=True)
        with open(ruta, "a+") as archivo:
            fcntl.flock(archivo, fcntl.LOCK_EX)
            archivo.seek(0)
            datos = json.loads(archivo.read() or '{"folios": {}, "boletas": []}')
            yield datos
            archivo.seek(0)
            archivo.truncate()
            archivo.write(json.dumps(datos))

    def _resultado(self, boleta, con_pdf=False):
        return ResultadoEmision(
            folio=boleta["folio"],
            fecha=date.fromisoformat(boleta["fecha"]),
            rut_receptor=boleta["rut_receptor"],
            monto_bruto=boleta["monto_bruto"],
            monto_retencion=boleta["monto_retencion"],
            monto_liquido=boleta["monto_liquido"],
            anulada=boleta["anulada"],
            codigo_sii=f"FAKE-{boleta['folio']}",
            pdf=_pdf_simulado(boleta["folio"]) if con_pdf else b"",
        )

    def _login(self):
        if self.escenario == "credencial_rechazada":
            raise ErrorCredencial("clave_rechazada", "El SII rechazó la clave de la cuenta autorizada.")

    def _fallar_antes(self):
        self._login()
        if self.escenario == "timeout_antes":
            raise ErrorAntesDeEnviar("timeout", "El portal del SII no respondió.")
        if self.escenario == "sin_delegacion":
            raise ErrorNegocio("delegacion_inactiva", "La cuenta no está autorizada para este emisor.")
        if self.escenario == "error_negocio":
            raise ErrorNegocio("rechazada_sii", "El SII rechazó los datos del receptor.")

    def emitir(self, datos):
        self._fallar_antes()
        if self.escenario == "caida_despues_sin_boleta":
            raise ErrorDespuesDeEnviar("sin_respuesta", "Se perdió la conexión después de enviar.")
        _, retencion, liquido = calcular_retencion(datos.monto_bruto, datos.fecha)
        with self._registro() as registro:
            rut_emisor = _rut(datos.rut_emisor)
            folio = registro["folios"].get(rut_emisor, 0) + 1
            registro["folios"][rut_emisor] = folio
            boleta = {
                "rut_emisor": rut_emisor,
                "folio": str(folio),
                "fecha": datos.fecha.isoformat(),
                "rut_receptor": _rut(datos.receptor.rut),
                "monto_bruto": datos.monto_bruto,
                "monto_retencion": retencion,
                "monto_liquido": liquido,
                "anulada": False,
                "busquedas_ocultas": 1 if self.escenario == "caida_despues_demora" else 0,
            }
            registro["boletas"].append(boleta)
        if self.escenario in ("caida_despues", "caida_despues_demora"):
            raise ErrorDespuesDeEnviar("sin_respuesta", "Se perdió la conexión después de enviar.")
        return self._resultado(boleta, con_pdf=True)

    def anular(self, rut_emisor, folio, causa):
        if causa not in CausaAnulacion.values:
            raise ErrorNegocio("causa_invalida", "Causa de anulación desconocida.")
        self._fallar_antes()
        if self.escenario == "caida_despues_sin_boleta":
            raise ErrorDespuesDeEnviar("sin_respuesta", "Se perdió la conexión después de enviar.")
        with self._registro() as registro:
            boleta = next(
                (b for b in registro["boletas"] if b["rut_emisor"] == _rut(rut_emisor) and b["folio"] == str(folio)),
                None,
            )
            if boleta is None:
                raise ErrorNegocio("folio_inexistente", "El SII no encontró la boleta.")
            if boleta["anulada"]:
                raise ErrorNegocio("ya_anulada", "La boleta ya estaba anulada.")
            boleta["anulada"] = True
            boleta["causa_anulacion"] = causa
        if self.escenario in ("caida_despues", "caida_despues_demora"):
            raise ErrorDespuesDeEnviar("sin_respuesta", "Se perdió la conexión después de enviar.")

    def buscar(self, rut_emisor, rut_receptor, fecha, monto_bruto):
        self._login()
        encontradas = []
        with self._registro() as registro:
            for boleta in registro["boletas"]:
                coincide = (
                    boleta["rut_emisor"] == _rut(rut_emisor)
                    and boleta["rut_receptor"] == _rut(rut_receptor)
                    and boleta["fecha"] == fecha.isoformat()
                    and boleta["monto_bruto"] == monto_bruto
                )
                if not coincide:
                    continue
                # Simula que el portal tarda en mostrar una boleta recién emitida.
                if boleta["busquedas_ocultas"]:
                    boleta["busquedas_ocultas"] -= 1
                    continue
                encontradas.append(self._resultado(boleta))
        return encontradas

    def verificar_delegacion(self, rut_emisor):
        self._login()
        return self.escenario != "sin_delegacion"
