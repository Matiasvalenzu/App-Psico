from django.db import models
from django.conf import settings
from django.db.models import Max
from django.utils import timezone
from pgvector.django import VectorField
from pacientes.models import Paciente


class Sesion(models.Model):
    class Origen(models.TextChoices):
        AUDIO = "AUDIO", "Audio"
        DOCUMENTO_EXTERNO = "DOCUMENTO_EXTERNO", "Documento externo"
        VIRTUAL = "VIRTUAL", "Sesión remota"

    class Plataforma(models.TextChoices):
        GOOGLE_MEET = "GOOGLE_MEET", "Google Meet"
        ZOOM = "ZOOM", "Zoom"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        PROCESANDO = "PROCESANDO", "Procesando"
        COMPLETADO = "COMPLETADO", "Completado"
        ERROR = "ERROR", "Error"

    paciente = models.ForeignKey(
        Paciente, on_delete=models.CASCADE, related_name="sesiones"
    )
    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sesiones_psicologo",
    )
    numero_sesion = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    fecha_hora_inicio = models.DateTimeField(default=timezone.now)
    duracion_segundos = models.PositiveIntegerField(null=True, blank=True)
    audio_path = models.CharField(max_length=500, blank=True, default="")
    origen = models.CharField(
        max_length=30, choices=Origen.choices, default=Origen.AUDIO
    )
    documento_nombre_original = models.CharField(max_length=255, blank=True, default="")
    documento_mime_type = models.CharField(max_length=120, blank=True, default="")
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    notas_sesion = models.TextField(blank=True, default="")
    plataforma_virtual = models.CharField(
        max_length=20, choices=Plataforma.choices, null=True, blank=True
    )
    url_reunion = models.URLField(null=True, blank=True)
    captions_buffer = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_hora_inicio"]

    def save(self, *args, **kwargs):
        if (
            self.numero_sesion is None
            and self.paciente_id
            and self.origen != self.Origen.DOCUMENTO_EXTERNO
        ):
            max_numero = (
                Sesion.objects.filter(paciente_id=self.paciente_id)
                .exclude(pk=self.pk)
                .exclude(origen=self.Origen.DOCUMENTO_EXTERNO)
                .aggregate(max_numero=Max("numero_sesion"))["max_numero"]
                or 0
            )
            self.numero_sesion = max_numero + 1
        super().save(*args, **kwargs)

    def __str__(self):
        numero = f" #{self.numero_sesion}" if self.numero_sesion else ""
        return f"Sesión{numero} {self.paciente} - {self.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')}"


class TranscripcionSegmento(models.Model):
    class Hablante(models.TextChoices):
        PSICOLOGO = "PSICOLOGO", "Psicólogo"
        PACIENTE = "PACIENTE", "Paciente"
        DOCUMENTO = "DOCUMENTO", "Documento"

    sesion = models.ForeignKey(
        Sesion, on_delete=models.CASCADE, related_name="segmentos"
    )
    orden = models.PositiveIntegerField()
    inicio_segundo = models.FloatField()
    fin_segundo = models.FloatField()
    hablante = models.CharField(max_length=20, choices=Hablante.choices)
    speaker_label = models.CharField(max_length=80, blank=True, default="")
    speaker_match_score = models.FloatField(null=True, blank=True)
    speaker_match_threshold = models.FloatField(null=True, blank=True)
    speaker_match_model = models.CharField(max_length=120, blank=True, default="")
    texto = models.TextField()
    texto_original = models.TextField(blank=True, default="")
    embedding = VectorField(dimensions=1024, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sesion", "orden"]

    def __str__(self):
        return f"[{self.inicio_segundo:.1f}s-{self.fin_segundo:.1f}s] {self.hablante}: {self.texto[:60]}"


class SpeakerIdentificationResult(models.Model):
    sesion = models.ForeignKey(
        Sesion, on_delete=models.CASCADE, related_name="speaker_results"
    )
    pyannote_label = models.CharField(max_length=80, blank=True, default="")
    matched_profile = models.ForeignKey(
        "voz.VoiceProfile", null=True, blank=True, on_delete=models.SET_NULL
    )
    score = models.FloatField(null=True, blank=True)
    threshold = models.FloatField()
    assigned_hablante = models.CharField(
        max_length=20,
        choices=TranscripcionSegmento.Hablante.choices,
        default=TranscripcionSegmento.Hablante.PACIENTE,
    )
    total_duration_seconds = models.FloatField(default=0)
    turn_count = models.PositiveIntegerField(default=0)
    model_name = models.CharField(max_length=120, blank=True, default="")
    reason = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sesion", "pyannote_label"]

    def __str__(self):
        return f"{self.sesion_id} {self.pyannote_label}: {self.assigned_hablante} ({self.score})"
