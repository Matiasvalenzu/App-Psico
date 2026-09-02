from django.conf import settings
from django.db import models


class NotificacionEmail(models.Model):
    class Tipo(models.TextChoices):
        BIENVENIDA = "BIENVENIDA", "Bienvenida"
        RESERVA_PACIENTE = "RESERVA_PACIENTE", "Reserva para paciente"
        RESERVA_PSICOLOGO = "RESERVA_PSICOLOGO", "Reserva para psicólogo"
        REPROGRAMACION_PACIENTE = "REPROGRAMACION_PACIENTE", "Reprogramación para paciente"
        REPROGRAMACION_PSICOLOGO = "REPROGRAMACION_PSICOLOGO", "Reprogramación para psicólogo"
        CANCELACION_PACIENTE = "CANCELACION_PACIENTE", "Cancelación para paciente"
        CANCELACION_PSICOLOGO = "CANCELACION_PSICOLOGO", "Cancelación para psicólogo"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        ENVIANDO = "ENVIANDO", "Enviando"
        ENVIADA = "ENVIADA", "Enviada"
        ERROR = "ERROR", "Error"

    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    destinatario = models.EmailField()
    responder_a = models.EmailField(blank=True, default="")
    clave_deduplicacion = models.CharField(max_length=160, unique=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notificaciones_email",
    )
    cita = models.ForeignKey(
        "agenda.AgendaCita",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notificaciones_email",
    )
    evento_reserva = models.ForeignKey(
        "agenda.AgendaReservaEvento",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notificaciones_email",
    )
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
        db_index=True,
    )
    intentos = models.PositiveSmallIntegerField(default=0)
    proximo_intento_at = models.DateTimeField(null=True, blank=True, db_index=True)
    enviada_at = models.DateTimeField(null=True, blank=True)
    ultimo_error = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notificación por email"
        verbose_name_plural = "Notificaciones por email"

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.destinatario} ({self.estado})"
