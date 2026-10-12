from django.conf import settings
from django.db import models

from pacientes.documentos import TIPOS_DOCUMENTO
from pacientes.models import Paciente
from sesiones.models import Sesion


class Cobro(models.Model):
    """Cobro de una atención y el borrador de su boleta de honorarios.

    La boleta se emite en el portal del SII; aquí solo se guarda el folio que informa el psicólogo.
    Los datos del receptor son una copia al momento del cobro y no deben salir en logs.
    """

    class MedioPago(models.TextChoices):
        EFECTIVO = "EFECTIVO", "Efectivo"
        TRANSFERENCIA = "TRANSFERENCIA", "Transferencia"
        OTRO = "OTRO", "Otro"

    class EstadoPago(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        PAGADO = "PAGADO", "Pagado"

    class ModoBoleta(models.TextChoices):
        # Receptor persona natural: el psicólogo hace la retención y la paga en su F29.
        RETENCION_POR_EMISOR = "RETENCION_POR_EMISOR", "Retención a cargo del emisor"
        RECEPTOR_RETIENE = "RECEPTOR_RETIENE", "El receptor retiene"
        SIN_DATOS_RECEPTOR = "SIN_DATOS_RECEPTOR", "Sin datos del receptor"

    class EstadoBoleta(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        EMITIDA = "EMITIDA", "Emitida"
        ANULADA = "ANULADA", "Anulada"
        NO_APLICA = "NO_APLICA", "No aplica"

    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cobros"
    )
    paciente = models.ForeignKey(
        Paciente, null=True, blank=True, on_delete=models.SET_NULL, related_name="cobros"
    )
    sesion = models.ForeignKey(
        Sesion, null=True, blank=True, on_delete=models.SET_NULL, related_name="cobros"
    )
    fecha_pago = models.DateField()
    monto_bruto = models.PositiveIntegerField()
    medio_pago = models.CharField(
        max_length=20, choices=MedioPago.choices, default=MedioPago.TRANSFERENCIA
    )
    estado_pago = models.CharField(
        max_length=20, choices=EstadoPago.choices, default=EstadoPago.PAGADO
    )

    receptor_tipo_doc = models.CharField(max_length=20, choices=TIPOS_DOCUMENTO, default="RUT")
    receptor_documento = models.CharField(max_length=30, blank=True, default="")
    receptor_nombre = models.CharField(max_length=200, blank=True, default="")
    receptor_direccion = models.CharField(max_length=255, blank=True, default="")
    receptor_comuna = models.CharField(max_length=100, blank=True, default="")
    receptor_email = models.EmailField(blank=True, default="")

    glosa = models.CharField(max_length=200)
    bhe_modo = models.CharField(
        max_length=30, choices=ModoBoleta.choices, default=ModoBoleta.RETENCION_POR_EMISOR
    )
    tasa_retencion = models.DecimalField(max_digits=5, decimal_places=2)
    monto_retencion = models.PositiveIntegerField()
    monto_liquido = models.PositiveIntegerField()

    estado_boleta = models.CharField(
        max_length=20, choices=EstadoBoleta.choices, default=EstadoBoleta.PENDIENTE
    )
    boleta_folio = models.CharField(max_length=30, blank=True, default="")
    boleta_fecha_emision = models.DateField(null=True, blank=True)
    boleta_anulada_at = models.DateTimeField(null=True, blank=True)
    notas = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_pago", "-id"]

    def __str__(self):
        return f"Cobro #{self.pk} - {self.fecha_pago}"
