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
        on_delete=models.SET_NULL,
        related_name="agenda_citas",
        null=True,
        blank=True,
    )
    prospecto_nombre = models.CharField(max_length=100, blank=True, default="")
    prospecto_apellido = models.CharField(max_length=100, blank=True, default="")
    prospecto_email = models.EmailField(blank=True, default="")
    prospecto_telefono_whatsapp = models.CharField(max_length=30, blank=True, default="")
    prospecto_motivo_consulta = models.TextField(blank=True, default="")
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
    google_calendar_id = models.CharField(max_length=255, blank=True, default="")
    google_event_id = models.CharField(max_length=255, blank=True, default="", db_index=True)
    google_synced_at = models.DateTimeField(null=True, blank=True)
    google_sync_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["inicio"]

    def __str__(self):
        nombre = self.paciente or f"{self.prospecto_nombre} {self.prospecto_apellido}".strip()
        return f"{nombre or 'Sin paciente'} - {self.inicio.strftime('%d/%m/%Y %H:%M')}"


class AgendaGoogleCalendarConnection(models.Model):
    psicologo = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agenda_google_calendar",
    )
    calendar_name = models.CharField(max_length=100, default="Agenda Psicológica")
    calendar_id = models.CharField(max_length=255, blank=True, default="")
    access_token = models.TextField(blank=True, default="")
    refresh_token = models.TextField(blank=True, default="")
    token_expires_at = models.DateTimeField(null=True, blank=True)
    scope = models.TextField(blank=True, default="")
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def connected(self):
        return bool(self.refresh_token)

    def __str__(self):
        return f"{self.psicologo} - {self.calendar_name}"


class AgendaGoogleOAuthState(models.Model):
    psicologo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    state = models.CharField(max_length=128, unique=True)
    redirect_uri = models.URLField(max_length=500)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        from django.utils import timezone

        return timezone.now() >= self.expires_at
