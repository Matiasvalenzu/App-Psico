from django.db import models
from django.conf import settings

from .documentos import TIPOS_DOCUMENTO


class Paciente(models.Model):
    class Estado(models.TextChoices):
        EN_SESION = "EN_SESION", "En sesión"
        ALTA = "ALTA", "Alta"
        ABANDONO = "ABANDONO", "Abandono"
        PAUSADO = "PAUSADO", "Pausado"
        DERIVADO = "DERIVADO", "Derivado"

    SEXO_CHOICES = [
        ("M", "Masculino"),
        ("F", "Femenino"),
        ("O", "Otro"),
        ("N", "No especifica"),
    ]

    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pacientes",
    )
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    rut = models.CharField(max_length=12, blank=True, default="")
    tipo_documento = models.CharField(
        max_length=15, choices=TIPOS_DOCUMENTO, default="RUT"
    )
    numero_documento = models.CharField(max_length=30, blank=True, default="")
    documento_normalizado = models.CharField(max_length=30, blank=True, default="", db_index=True)
    edad = models.IntegerField(null=True, blank=True)
    sexo = models.CharField(
        max_length=1,
        choices=SEXO_CHOICES,
        blank=True,
        default="N",
    )
    ocupacion_laboral = models.CharField(max_length=200, blank=True, default="")
    motivo_consulta = models.TextField(blank=True, default="")
    telefono_whatsapp = models.CharField(max_length=30, blank=True, default="")
    email_contacto = models.EmailField(blank=True, default="")
    nacionalidad = models.CharField(max_length=100, blank=True, default="")
    religion = models.CharField(max_length=100, blank=True, default="")
    direccion = models.CharField(max_length=255, blank=True, default="")
    comuna = models.CharField(max_length=100, blank=True, default="")
    prevision = models.CharField(max_length=100, blank=True, default="")
    es_menor_edad = models.BooleanField(default=False)
    nombre_tutor = models.CharField(max_length=200, blank=True, default="")
    telefono_tutor = models.CharField(max_length=30, blank=True, default="")
    contacto_emergencia_nombre = models.CharField(max_length=200, blank=True, default="")
    contacto_emergencia_telefono = models.CharField(max_length=30, blank=True, default="")
    origen_consulta = models.CharField(max_length=100, blank=True, default="")
    derivacion_interconsulta = models.TextField(blank=True, default="")
    diagnostico_sospechado = models.TextField(blank=True, default="")
    medicacion_actual = models.TextField(blank=True, default="")
    riesgo_suicida = models.BooleanField(default=False)
    ideacion_suicida_nivel = models.PositiveSmallIntegerField(null=True, blank=True)
    frecuencia_atencion = models.CharField(max_length=80, blank=True, default="")
    objetivos_intervencion = models.TextField(blank=True, default="")
    notas_privadas = models.TextField(blank=True, default="")
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.EN_SESION,
        db_index=True,
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["apellido", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["psicologo", "tipo_documento", "documento_normalizado"],
                condition=~models.Q(documento_normalizado=""),
                name="paciente_documento_unico_por_psicologo",
            )
        ]

    def __str__(self):
        return f"{self.nombre} {self.apellido}"

    @property
    def nombre_completo(self):
        return f"{self.nombre} {self.apellido}"


class ConsentimientoInformado(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        ENVIADO = "ENVIADO", "Enviado / Pendiente de firma"
        FIRMADO = "FIRMADO", "Firmado digitalmente"
        RECHAZADO = "RECHAZADO", "Rechazado"

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="consentimientos",
    )
    psicologo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="consentimientos_emitidos",
    )
    titulo = models.CharField(
        max_length=255,
        default="Consentimiento Informado para Atención Psicológica",
    )
    contenido = models.TextField(help_text="Texto completo del consentimiento redactado.")
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.BORRADOR,
        db_index=True,
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    enlace_firma = models.URLField(max_length=500, blank=True, default="")
    email_destino = models.EmailField(blank=True, default="")
    email_enviado = models.BooleanField(default=False)
    email_error = models.TextField(blank=True, default="")
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_firma = models.DateTimeField(null=True, blank=True)

    # Datos de firma digital
    firma_nombre = models.CharField(max_length=200, blank=True, default="")
    firma_rut = models.CharField(max_length=30, blank=True, default="")
    firma_imagen = models.TextField(blank=True, default="", help_text="Data URL base64 de la firma gráfica")
    firma_ip = models.CharField(max_length=60, blank=True, default="")
    firma_user_agent = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Consentimiento Informado"
        verbose_name_plural = "Consentimientos Informados"

    def __str__(self):
        return f"Consentimiento {self.paciente.nombre_completo} ({self.estado})"

