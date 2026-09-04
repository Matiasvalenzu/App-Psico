from django.conf import settings
from django.db import models


class FeedbackReport(models.Model):
    TIPO_CHOICES = [
        ("error", "Reporte de Error (Bug)"),
        ("mejora", "Sugerencia de Mejora"),
        ("felicitacion", "Felicitación / Reconocimiento"),
        ("consulta", "Consulta o Pregunta"),
    ]

    MODULO_CHOICES = [
        ("general", "General / Interfaz"),
        ("pacientes", "Pacientes / Ficha Clínica"),
        ("sesiones", "Sesiones y Transcripción"),
        ("agenda", "Agenda y Citas"),
        ("tests", "Tests Psicológicos"),
        ("facturacion", "Facturación / Boletas SII"),
        ("suscripcion", "Mi Suscripción"),
        ("perfil", "Mi Perfil / Configuración"),
    ]

    SEVERIDAD_CHOICES = [
        ("baja", "Baja — Inconveniente estético o menor"),
        ("media", "Media — Función lenta o con falla parcial"),
        ("alta", "Alta — Dificulta significativamente el trabajo"),
        ("critica", "Crítica — Bloqueo total o pérdida de datos"),
    ]

    ESTADO_CHOICES = [
        ("nuevo", "Nuevo"),
        ("en_revision", "En revisión"),
        ("resuelto", "Resuelto"),
        ("descartado", "Descartado"),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feedbacks",
        verbose_name="Usuario",
    )
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default="mejora",
        verbose_name="Tipo de Feedback",
    )
    modulo = models.CharField(
        max_length=30,
        choices=MODULO_CHOICES,
        default="general",
        verbose_name="Módulo relacionado",
    )
    severidad = models.CharField(
        max_length=20,
        choices=SEVERIDAD_CHOICES,
        default="media",
        verbose_name="Severidad / Urgencia",
    )
    titulo = models.CharField(
        max_length=200,
        verbose_name="Título o Asunto",
    )
    descripcion = models.TextField(
        verbose_name="Descripción detallada",
    )
    pasos_reproducir = models.TextField(
        blank=True,
        default="",
        verbose_name="Pasos para reproducir (en errores)",
    )
    impacto_mejora = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Impacto estimado de la mejora",
    )
    archivo_adjunto = models.FileField(
        upload_to="feedback_adjuntos/%Y/%m/",
        null=True,
        blank=True,
        verbose_name="Captura o Archivo adjunto",
    )
    url_origen = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="URL o Pantalla origen",
    )
    user_agent = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="Navegador y Sistema Operativo",
    )
    resolucion_pantalla = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Resolución de pantalla",
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default="nuevo",
        verbose_name="Estado de atención",
    )
    respuesta_admin = models.TextField(
        blank=True,
        default="",
        verbose_name="Respuesta del equipo de soporte",
    )
    respondido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedbacks_respondidos",
        verbose_name="Respondido por",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de creación",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Última actualización",
    )
    resuelto_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de resolución",
    )

    class Meta:
        verbose_name = "Reporte de Feedback / Error"
        verbose_name_plural = "Reportes de Feedback y Errores"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.titulo} ({self.usuario.username})"
