from django.conf import settings
from django.db import models
from django.utils import timezone

from pacientes.models import Paciente
from sesiones.models import Sesion


class EvaluacionAsignada(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        ENVIADO = "ENVIADO", "Enviado"
        COMPLETADO = "COMPLETADO", "Completado"
        EXPIRADO = "EXPIRADO", "Expirado"
        ERROR_ENVIO = "ERROR_ENVIO", "Error de envío"

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="evaluaciones_asignadas",
    )
    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="evaluaciones_asignadas",
    )
    sesion = models.OneToOneField(
        Sesion,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="evaluacion_asignada",
    )
    test_slug = models.CharField(max_length=80, db_index=True)
    token_hash = models.CharField(max_length=64, unique=True)
    enlace_generado = models.URLField(max_length=500, blank=True, default="")
    email_destino = models.EmailField()
    mensaje_email = models.TextField(blank=True, default="")
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
        db_index=True,
    )
    email_enviado = models.BooleanField(default=False)
    email_error = models.TextField(blank=True, default="")
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_expiracion = models.DateTimeField()
    fecha_completado = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.test_slug} - {self.paciente.nombre_completo} ({self.estado})"

    @property
    def esta_expirada(self):
        return self.fecha_expiracion <= timezone.now()


class ResultadoEvaluacion(models.Model):
    class EstadoIA(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        GENERADA = "GENERADA", "Generada"
        SIN_CONFIGURACION = "SIN_CONFIGURACION", "Sin configuración"
        ERROR = "ERROR", "Error"

    asignacion = models.OneToOneField(
        EvaluacionAsignada,
        on_delete=models.CASCADE,
        related_name="resultado",
    )
    respuestas = models.JSONField(default=dict)
    puntajes = models.JSONField(default=dict)
    interpretacion = models.JSONField(default=dict)
    observacion_ia = models.TextField(blank=True, default="")
    estado_ia = models.CharField(
        max_length=20,
        choices=EstadoIA.choices,
        default=EstadoIA.PENDIENTE,
    )
    error_ia = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Resultado {self.asignacion}"
