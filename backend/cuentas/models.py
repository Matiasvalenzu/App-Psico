from django.conf import settings
from django.db import models


class PerfilPsicologo(models.Model):
    class Modalidad(models.TextChoices):
        PRESENCIAL = "PRESENCIAL", "Presencial"
        ONLINE = "ONLINE", "Online"
        HIBRIDA = "HIBRIDA", "Presencial y online"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="perfil_psicologo",
    )
    email_notificaciones = models.EmailField(blank=True, default="")
    email_notificaciones_verificado_at = models.DateTimeField(null=True, blank=True)
    email_notificaciones_pendiente = models.EmailField(blank=True, default="")
    email_verificacion_hash = models.CharField(max_length=64, blank=True, default="")
    email_verificacion_expira_at = models.DateTimeField(null=True, blank=True)
    email_verificacion_intentos = models.PositiveSmallIntegerField(default=0)
    rut_profesional = models.CharField(max_length=12, blank=True, default="")
    especialidad_clinica = models.CharField(max_length=180, blank=True, default="")
    registro_profesional = models.CharField(max_length=80, blank=True, default="")
    telefono_profesional = models.CharField(max_length=30, blank=True, default="")
    modalidad_atencion = models.CharField(
        max_length=15,
        choices=Modalidad.choices,
        default=Modalidad.HIBRIDA,
    )
    comuna = models.CharField(max_length=100, blank=True, default="")
    direccion_consulta = models.CharField(max_length=255, blank=True, default="")
    tutorial_visto = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def email_notificaciones_efectivo(self):
        if self.email_notificaciones and self.email_notificaciones_verificado_at:
            return self.email_notificaciones
        return self.user.email

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class CodigoVerificacionRegistro(models.Model):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")
    password_hash = models.CharField(max_length=128)
    codigo_hash = models.CharField(max_length=64)
    expira_at = models.DateTimeField()
    intentos = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Código de Verificación de Registro"
        verbose_name_plural = "Códigos de Verificación de Registro"

    def __str__(self):
        return f"Registro pendiente: {self.email}"


class RegistroConsumoIA(models.Model):
    class Servicio(models.TextChoices):
        CHAT_CLINICO = "CHAT_CLINICO", "Chat Clínico"
        EVALUACION_TEST = "EVALUACION_TEST", "Evaluación / Test"
        OTRO = "OTRO", "Otro"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="consumos_ia",
    )
    servicio = models.CharField(
        max_length=30,
        choices=Servicio.choices,
        default=Servicio.OTRO,
    )
    modelo = models.CharField(max_length=50, default="deepseek-chat")
    tokens_prompt = models.PositiveIntegerField(default=0)
    tokens_completion = models.PositiveIntegerField(default=0)
    tokens_total = models.PositiveIntegerField(default=0)
    costo_estimado_usd = models.DecimalField(
        max_digits=10, decimal_places=6, default=0
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Registro de Consumo IA"
        verbose_name_plural = "Registros de Consumo IA"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.servicio}: {self.tokens_total} tokens"
