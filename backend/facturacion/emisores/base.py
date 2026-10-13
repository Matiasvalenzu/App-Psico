"""Interfaz del emisor de boletas de honorarios en el portal del SII, como usuario autorizado.

La tarea de emisión decide según el tipo de error:
- ErrorAntesDeEnviar: no se llegó a enviar nada; se puede reintentar.
- ErrorNegocio: el SII rechazó la boleta; no se reintenta.
- ErrorDespuesDeEnviar: no se sabe si quedó emitida; nunca se reintenta, solo se busca.
- ErrorCredencial: el SII rechazó la clave de la cuenta autorizada; no se reintenta y se pausa
  la cola, porque varios intentos fallidos pueden bloquear la clave que usan todos los psicólogos.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date

from django.db import models

# Máximo de prestaciones que acepta el formulario del SII.
MAX_LINEAS = 10


class Retencion(models.TextChoices):
    # Valores del formulario del SII.
    RECEPTOR = "RETRECEPTOR", "Retiene el receptor"
    CONTRIBUYENTE = "RETCONTRIBUYENTE", "Retiene el emisor"


@dataclass(frozen=True)
class LineaBoleta:
    nombre: str
    monto: int


@dataclass(frozen=True)
class Receptor:
    rut: str
    nombre: str
    domicilio: str
    region: str
    comuna: str


@dataclass(frozen=True)
class DatosBoleta:
    rut_emisor: str
    receptor: Receptor
    fecha: date
    retencion: str
    lineas: tuple[LineaBoleta, ...]

    def __post_init__(self):
        if not 1 <= len(self.lineas) <= MAX_LINEAS:
            raise ValueError(f"La boleta debe tener entre 1 y {MAX_LINEAS} prestaciones.")
        if any(linea.monto <= 0 or not linea.nombre.strip() for linea in self.lineas):
            raise ValueError("Cada prestación necesita nombre y un monto mayor a cero.")
        if self.retencion not in Retencion.values:
            raise ValueError(f"Retención desconocida: {self.retencion}")

    @property
    def monto_bruto(self):
        return sum(linea.monto for linea in self.lineas)


@dataclass(frozen=True)
class ResultadoEmision:
    folio: str
    fecha: date
    rut_receptor: str
    monto_bruto: int
    # Lo que informa el SII, para compararlo con lo que calcula Psiconex.
    monto_retencion: int
    monto_liquido: int
    anulada: bool = False
    codigo_sii: str = ""
    pdf: bytes = b""
    # Pares (nombre, contenido) de capturas o HTML del portal.
    evidencias: tuple[tuple[str, bytes], ...] = ()


class ErrorEmisor(Exception):
    def __init__(self, codigo, detalle=""):
        super().__init__(f"{codigo}: {detalle}" if detalle else codigo)
        self.codigo = codigo
        self.detalle = detalle


class ErrorAntesDeEnviar(ErrorEmisor):
    pass


class ErrorNegocio(ErrorEmisor):
    pass


class ErrorDespuesDeEnviar(ErrorEmisor):
    pass


class ErrorCredencial(ErrorEmisor):
    pass


class EmisorBHE(ABC):
    nombre = ""

    @abstractmethod
    def emitir(self, datos: DatosBoleta) -> ResultadoEmision:
        ...

    @abstractmethod
    def buscar(self, rut_emisor: str, rut_receptor: str, fecha: date, monto_bruto: int) -> list[ResultadoEmision]:
        """Solo consulta, nunca envía. Puede haber varias si hubo boletas iguales el mismo día."""

    @abstractmethod
    def verificar_delegacion(self, rut_emisor: str) -> bool:
        ...
