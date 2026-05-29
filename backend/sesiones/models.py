from django.db import models
from django.utils import timezone
from pgvector.django import VectorField
from pacientes.models import Paciente


class Sesion(models.Model):
    class Origen(models.TextChoices):
        AUDIO = "AUDIO", "Audio"
        DOCUMENTO_EXTERNO = "DOCUMENTO_EXTERNO", "Documento externo"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        PROCESANDO = "PROCESANDO", "Procesando"
        COMPLETADO = "COMPLETADO", "Completado"
        ERROR = "ERROR", "Error"

    paciente = models.ForeignKey(
        Paciente, on_delete=models.CASCADE, related_name="sesiones"
    )
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_hora_inicio"]

    def __str__(self):
        return f"Sesión {self.paciente} - {self.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')}"


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
    texto = models.TextField()
    texto_original = models.TextField(blank=True, default="")
    embedding = VectorField(dimensions=1024, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sesion", "orden"]

    def __str__(self):
        return f"[{self.inicio_segundo:.1f}s-{self.fin_segundo:.1f}s] {self.hablante}: {self.texto[:60]}"
