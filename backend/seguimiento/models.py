"""Seguimiento clínico: escalas validadas, brief e informes IA, tareas intersesión y ánimo.

App aislada a propósito: no modifica modelos de otras apps (solo los referencia).
"""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from pacientes.models import Paciente


class AplicacionEscala(models.Model):
    """Una aplicación (o invitación) de una escala clínica a un paciente."""

    class Canal(models.TextChoices):
        EN_CONSULTA = "EN_CONSULTA", "En consulta"
        ENLACE = "ENLACE", "Enlace (copiar / WhatsApp manual)"
        EMAIL = "EMAIL", "Correo"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        COMPLETADA = "COMPLETADA", "Completada"
        CANCELADA = "CANCELADA", "Cancelada"

    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name="aplicaciones_escala")
    psicologo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="aplicaciones_escala")
    escala = models.CharField(max_length=30, db_index=True)
    canal = models.CharField(max_length=20, choices=Canal.choices, default=Canal.EN_CONSULTA)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE, db_index=True)
    token_hash = models.CharField(max_length=64, unique=True, null=True, blank=True)
    expira_en = models.DateTimeField(null=True, blank=True)
    respuestas = models.JSONField(default=dict, blank=True)
    resultado = models.JSONField(default=dict, blank=True)
    puntaje_total = models.IntegerField(null=True, blank=True)
    severidad = models.CharField(max_length=30, blank=True, default="")
    alerta_riesgo = models.BooleanField(default=False, db_index=True)
    alerta_revisada_en = models.DateTimeField(null=True, blank=True)
    completada_en = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["paciente", "completada_en"])]

    @property
    def vencida(self):
        return bool(self.expira_en and self.expira_en <= timezone.now())


class DiagnosticoCIE10(models.Model):
    paciente = models.OneToOneField(Paciente, on_delete=models.CASCADE, related_name="diagnostico_cie10")
    codigo = models.CharField(max_length=10, blank=True, default="")
    descripcion = models.CharField(max_length=255, blank=True, default="")
    presuntivo = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


class DocumentoClinicoIA(models.Model):
    """Brief previo a la sesión o informe para terceros (borrador IA editable)."""

    class Tipo(models.TextChoices):
        BRIEF = "BRIEF", "Brief previo a la sesión"
        AVANCE = "AVANCE", "Informe de avance terapéutico"
        COLEGIO = "COLEGIO", "Informe para establecimiento educacional"
        TRIBUNAL = "TRIBUNAL", "Informe para Tribunal de Familia"
        LICENCIA = "LICENCIA", "Informe para licencia médica"
        DERIVACION = "DERIVACION", "Informe de derivación / interconsulta"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        LISTO = "LISTO", "Listo"
        ERROR = "ERROR", "Error"

    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name="documentos_clinicos_ia")
    psicologo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="documentos_clinicos_ia")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    destinatario = models.CharField(max_length=255, blank=True, default="")
    contexto_adicional = models.TextField(blank=True, default="")
    diagnostico_codigo = models.CharField(max_length=10, blank=True, default="")
    diagnostico_descripcion = models.CharField(max_length=255, blank=True, default="")
    contenido = models.TextField(blank=True, default="")
    advertencias = models.JSONField(default=list, blank=True)
    error = models.TextField(blank=True, default="")
    modelo = models.CharField(max_length=80, blank=True, default="")
    es_borrador = models.BooleanField(default=True)
    finalizado_en = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class TareaIntersesion(models.Model):
    class CompletadaPor(models.TextChoices):
        PSICOLOGO = "PSICOLOGO", "Psicólogo/a"
        PACIENTE = "PACIENTE", "Paciente"

    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name="tareas_intersesion")
    psicologo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tareas_intersesion")
    sesion = models.ForeignKey("sesiones.Sesion", null=True, blank=True, on_delete=models.SET_NULL, related_name="tareas_intersesion")
    descripcion = models.TextField(max_length=1000)
    fecha_entrega = models.DateField(null=True, blank=True)
    completada = models.BooleanField(default=False)
    completada_en = models.DateTimeField(null=True, blank=True)
    completada_por = models.CharField(max_length=20, choices=CompletadaPor.choices, blank=True, default="")
    nota_paciente = models.TextField(blank=True, default="")
    visible_para_paciente = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["completada", "fecha_entrega", "-created_at"]


class RegistroAnimo(models.Model):
    class Origen(models.TextChoices):
        PSICOLOGO = "PSICOLOGO", "Psicólogo/a"
        PACIENTE = "PACIENTE", "Paciente"

    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name="registros_animo")
    fecha = models.DateField(default=timezone.localdate)
    valor = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    emociones = models.JSONField(default=list, blank=True)
    nota = models.TextField(blank=True, default="", max_length=500)
    registrado_por = models.CharField(max_length=20, choices=Origen.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["paciente", "fecha", "registrado_por"], name="animo_unico_por_dia_y_origen"),
        ]


class PortalSeguimiento(models.Model):
    paciente = models.OneToOneField(Paciente, on_delete=models.CASCADE, related_name="portal_seguimiento")
    token_hash = models.CharField(max_length=64, unique=True)
    activo = models.BooleanField(default=True)
    expira_en = models.DateTimeField()
    ultimo_acceso = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def vigente(self):
        return self.activo and self.expira_en > timezone.now()
