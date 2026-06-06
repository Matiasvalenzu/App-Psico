from django.conf import settings
from django.db import models

from pacientes.models import Paciente


class AgendaCita(models.Model):
    class Estado(models.TextChoices):
        PROGRAMADA = "PROGRAMADA", "Programada"
        CONFIRMACION_SOLICITADA = "CONFIRMACION_SOLICITADA", "Confirmación solicitada"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        ANULADA = "ANULADA", "Anulada"

    class Recurrencia(models.TextChoices):
        NINGUNA = "NINGUNA", "Sin recurrencia"
        SEMANAL = "SEMANAL", "Semanal"
        QUINCENAL = "QUINCENAL", "Cada dos semanas"

    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agenda_citas",
    )
    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="agenda_citas",
    )
    inicio = models.DateTimeField(db_index=True)
    fin = models.DateTimeField(db_index=True)
    estado = models.CharField(
        max_length=30,
        choices=Estado.choices,
        default=Estado.PROGRAMADA,
        db_index=True,
    )
    notas = models.TextField(blank=True, default="")
    motivo_anulacion = models.TextField(blank=True, default="")
    recurrencia = models.CharField(
        max_length=20,
        choices=Recurrencia.choices,
        default=Recurrencia.NINGUNA,
    )
    recurrente_hasta = models.DateField(null=True, blank=True)
    grupo_recurrencia = models.UUIDField(null=True, blank=True, db_index=True)
    confirmacion_solicitada_at = models.DateTimeField(null=True, blank=True)
    confirmada_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["inicio"]

    def __str__(self):
        return f"{self.paciente} - {self.inicio.strftime('%d/%m/%Y %H:%M')}"
