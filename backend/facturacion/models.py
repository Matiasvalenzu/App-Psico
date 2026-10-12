from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models

from config.fields import EncryptedTextField
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
        # La emisión automática está en curso: no se edita ni se marca a mano.
        EN_EMISION = "EN_EMISION", "En emisión"
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
    # Sube cuando una emisión automática falla y se vuelve a intentar.
    version_emision = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_pago", "-id"]

    def __str__(self):
        return f"Cobro #{self.pk} - {self.fecha_pago}"


class DelegacionSII(models.Model):
    """Autorización que el psicólogo da en el SII a la cuenta de Psiconex para emitir sus boletas.

    Nunca se guarda la clave del psicólogo: el robot entra con la clave de la cuenta autorizada.
    """

    class Estado(models.TextChoices):
        NO_INICIADA = "NO_INICIADA", "No iniciada"
        PENDIENTE_VERIFICACION = "PENDIENTE_VERIFICACION", "Pendiente de verificación"
        ACTIVA = "ACTIVA", "Activa"
        POR_VENCER = "POR_VENCER", "Por vencer"
        VENCIDA = "VENCIDA", "Vencida"
        REVOCADA = "REVOCADA", "Revocada"
        ERROR = "ERROR", "Error"

    psicologo = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="delegacion_sii"
    )
    rut_emisor = models.CharField(max_length=12)
    estado = models.CharField(max_length=30, choices=Estado.choices, default=Estado.NO_INICIADA)
    fecha_otorgada = models.DateField(null=True, blank=True)
    # La autorización dura 1 año; si el portal muestra otra fecha, manda la del portal.
    fecha_vencimiento = models.DateField(null=True, blank=True)
    verificada = models.BooleanField(default=False)
    verificada_at = models.DateTimeField(null=True, blank=True)
    ultimo_error = models.TextField(blank=True, default="")
    consentimiento_at = models.DateTimeField(null=True, blank=True)
    consentimiento_version = models.CharField(max_length=20, blank=True, default="")
    piloto = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "delegación SII"
        verbose_name_plural = "delegaciones SII"

    def __str__(self):
        return f"Delegación #{self.pk} - {self.get_estado_display()}"

    def save(self, *args, **kwargs):
        if self.fecha_otorgada and not self.fecha_vencimiento:
            from .services import un_anio_despues

            self.fecha_vencimiento = un_anio_despues(self.fecha_otorgada)
        super().save(*args, **kwargs)


def _storage_bhe():
    # Fuera de MEDIA_ROOT: estos archivos solo se descargan por un endpoint autenticado.
    return FileSystemStorage(location=settings.BHE_STORAGE_PATH)


def _ruta_archivo_bhe(instance, filename):
    return f"{instance.cobro.psicologo_id}/{instance.pk}/{filename}"


class EmisionBHE(models.Model):
    """Un intento del robot de emitir o anular la boleta de un cobro.

    Los datos del receptor van solo en `payload`, cifrado; no deben salir en logs ni en el admin.
    """

    class Tipo(models.TextChoices):
        EMISION = "EMISION", "Emisión"
        ANULACION = "ANULACION", "Anulación"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "En cola"
        EN_CURSO = "EN_CURSO", "En curso"
        # En una anulación, EMITIDA significa que la anulación quedó hecha en el SII.
        EMITIDA = "EMITIDA", "Emitida"
        # El robot cayó después de enviar: nunca se reintenta solo, se confirma en el SII.
        DESCONOCIDO = "DESCONOCIDO", "Por confirmar"
        FALLIDA = "FALLIDA", "Fallida"
        CANCELADA = "CANCELADA", "Cancelada"

    ESTADOS_ACTIVOS = (Estado.PENDIENTE, Estado.EN_CURSO, Estado.EMITIDA, Estado.DESCONOCIDO)

    cobro = models.ForeignKey(Cobro, on_delete=models.CASCADE, related_name="emisiones")
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.EMISION)
    idempotency_key = models.CharField(max_length=80, unique=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    paso = models.CharField(max_length=40, blank=True, default="")
    intentos = models.PositiveSmallIntegerField(default=0)
    error_codigo = models.CharField(max_length=40, blank=True, default="")
    error_detalle = models.TextField(blank=True, default="")
    # Copia exacta de lo que se envió al SII (JSON).
    payload = EncryptedTextField(blank=True, default="")
    folio = models.CharField(max_length=30, blank=True, default="")
    codigo_sii = models.CharField(max_length=60, blank=True, default="")
    pdf = models.FileField(storage=_storage_bhe, upload_to=_ruta_archivo_bhe, blank=True)
    evidencias = models.JSONField(default=list, blank=True)
    solicitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    resuelta_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    resuelta_at = models.DateTimeField(null=True, blank=True)
    backend = models.CharField(max_length=20, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "emisión BHE"
        verbose_name_plural = "emisiones BHE"
        constraints = [
            models.UniqueConstraint(
                fields=["cobro", "tipo"],
                condition=models.Q(estado__in=["PENDIENTE", "EN_CURSO", "EMITIDA", "DESCONOCIDO"]),
                name="una_emision_activa_por_cobro",
            )
        ]

    def __str__(self):
        return f"Emisión #{self.pk} - {self.get_tipo_display()} {self.get_estado_display()}"

    @staticmethod
    def clave_idempotencia(cobro, tipo):
        sufijo = "anulacion:" if tipo == EmisionBHE.Tipo.ANULACION else ""
        return f"cobro:{cobro.pk}:{sufijo}v{cobro.version_emision}"


class ConfiguracionBHE(models.Model):
    """Pausa global de la emisión automática (una sola fila). Parte pausada."""

    pausada = models.BooleanField(default=True)
    pausada_motivo = models.CharField(max_length=200, blank=True, default="")
    pausada_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuración BHE"
        verbose_name_plural = "configuración BHE"

    def __str__(self):
        return "Emisión automática pausada" if self.pausada else "Emisión automática activa"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def cola_pausada(cls):
        # Sin fila se considera pausada: nunca se emite por omisión.
        config = cls.objects.filter(pk=1).first()
        return config is None or config.pausada
