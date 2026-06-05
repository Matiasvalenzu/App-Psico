from django.db import models
from django.contrib.auth import get_user_model
from pacientes.models import Paciente

User = get_user_model()


class ChatConversacion(models.Model):
    paciente = models.ForeignKey(
        Paciente, on_delete=models.CASCADE, related_name="conversaciones"
    )
    psicologo = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="chat_conversaciones",
    )
    titulo = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.titulo or f"Chat - {self.paciente}"


class ChatMensaje(models.Model):
    class Rol(models.TextChoices):
        USER = "USER", "Usuario"
        ASSISTANT = "ASSISTANT", "Asistente"

    conversacion = models.ForeignKey(
        ChatConversacion, on_delete=models.CASCADE, related_name="mensajes"
    )
    rol = models.CharField(max_length=10, choices=Rol.choices)
    contenido = models.TextField()
    fuentes_json = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.rol}] {self.contenido[:60]}"


class InformeIA(models.Model):
    class Tipo(models.TextChoices):
        RESUMEN_CLINICO = "RESUMEN_CLINICO", "Resumen clínico"
        EVOLUCION = "EVOLUCION", "Evolución"
        PROXIMA_SESION = "PROXIMA_SESION", "Próxima sesión"
        OTRO = "OTRO", "Otro"

    paciente = models.ForeignKey(
        Paciente, on_delete=models.CASCADE, related_name="informes_ia"
    )
    psicologo = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="informes_ia",
    )
    sesion = models.ForeignKey(
        "sesiones.Sesion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="informes_ia",
    )
    mensaje_origen = models.ForeignKey(
        ChatMensaje,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="informes_generados",
    )
    tipo = models.CharField(
        max_length=30, choices=Tipo.choices, default=Tipo.RESUMEN_CLINICO
    )
    titulo = models.CharField(max_length=200, blank=True, default="")
    contenido = models.TextField()
    fuentes_json = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.titulo or f"Informe IA - {self.paciente}"
