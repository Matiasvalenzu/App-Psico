from django.conf import settings
from django.db import models
from django.utils.text import slugify

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

    class OrigenReserva(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        PUBLICA_PACIENTE_EXISTENTE = "PUBLICA_PACIENTE_EXISTENTE", "Reserva pública — paciente existente"
        PUBLICA_PACIENTE_NUEVO = "PUBLICA_PACIENTE_NUEVO", "Reserva pública — paciente nuevo"

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
    origen_reserva = models.CharField(
        max_length=30,
        choices=OrigenReserva.choices,
        default=OrigenReserva.MANUAL,
        blank=True,
    )
    reserva_publica_at = models.DateTimeField(null=True, blank=True)
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


class AgendaPerfilPublico(models.Model):
    psicologo = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agenda_perfil_publico",
    )
    slug = models.SlugField(max_length=120, unique=True)
    activo = models.BooleanField(default=True)
    nombre_publico = models.CharField(max_length=200)
    subtitulo_publico = models.CharField(max_length=200, blank=True, default="")
    descripcion_publica = models.TextField(blank=True, default="")
    duracion_minutos = models.PositiveIntegerField(default=60)
    anticipacion_minima_horas = models.PositiveIntegerField(default=12)
    ventana_reserva_dias = models.PositiveIntegerField(default=30)
    acepta_pacientes_nuevos = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil público de agenda"
        verbose_name_plural = "Perfiles públicos de agenda"

    def __str__(self):
        return f"{self.nombre_publico} ({self.slug})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.nombre_publico)
            slug = base
            counter = 1
            while AgendaPerfilPublico.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class AgendaDisponibilidad(models.Model):
    DIA_SEMANA_CHOICES = [
        (0, "Lunes"),
        (1, "Martes"),
        (2, "Miércoles"),
        (3, "Jueves"),
        (4, "Viernes"),
        (5, "Sábado"),
        (6, "Domingo"),
    ]

    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agenda_disponibilidad",
    )
    dia_semana = models.IntegerField(choices=DIA_SEMANA_CHOICES)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["dia_semana", "hora_inicio"]
        unique_together = [("psicologo", "dia_semana", "hora_inicio")]
        verbose_name = "Disponibilidad"
        verbose_name_plural = "Disponibilidades"

    def __str__(self):
        return f"{self.get_dia_semana_display()} {self.hora_inicio}-{self.hora_fin}"


class AgendaBloqueo(models.Model):
    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agenda_bloqueos",
    )
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    motivo = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["inicio"]
        verbose_name = "Bloqueo de agenda"
        verbose_name_plural = "Bloqueos de agenda"

    def __str__(self):
        return f"Bloqueo {self.inicio.strftime('%d/%m %H:%M')}-{self.fin.strftime('%H:%M')}"


class AgendaReservaPublica(models.Model):
    class TipoPaciente(models.TextChoices):
        EXISTENTE = "EXISTENTE", "Paciente existente"
        NUEVO = "NUEVO", "Paciente nuevo"

    cita = models.OneToOneField(
        AgendaCita,
        on_delete=models.CASCADE,
        related_name="reserva_publica",
    )
    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reservas_publicas",
    )
    perfil = models.ForeignKey(
        AgendaPerfilPublico,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reservas",
    )
    tipo_paciente = models.CharField(max_length=20, choices=TipoPaciente.choices)
    ip_hash = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Reserva pública"
        verbose_name_plural = "Reservas públicas"

    def __str__(self):
        return f"Reserva {self.tipo_paciente} - {self.cita}"
