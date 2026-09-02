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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def email_notificaciones_efectivo(self):
        if self.email_notificaciones and self.email_notificaciones_verificado_at:
            return self.email_notificaciones
        return self.user.email

    def __str__(self):
        return self.user.get_full_name() or self.user.username
