from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("agenda", "0006_agendaperfilpublico_instrucciones_reserva"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificacionEmail",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("BIENVENIDA", "Bienvenida"),
                            ("RESERVA_PACIENTE", "Reserva para paciente"),
                            ("RESERVA_PSICOLOGO", "Reserva para psicólogo"),
                        ],
                        max_length=30,
                    ),
                ),
                ("destinatario", models.EmailField(max_length=254)),
                ("responder_a", models.EmailField(blank=True, default="", max_length=254)),
                ("clave_deduplicacion", models.CharField(max_length=160, unique=True)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("PENDIENTE", "Pendiente"),
                            ("ENVIANDO", "Enviando"),
                            ("ENVIADA", "Enviada"),
                            ("ERROR", "Error"),
                        ],
                        db_index=True,
                        default="PENDIENTE",
                        max_length=20,
                    ),
                ),
                ("intentos", models.PositiveSmallIntegerField(default=0)),
                (
                    "proximo_intento_at",
                    models.DateTimeField(blank=True, db_index=True, null=True),
                ),
                ("enviada_at", models.DateTimeField(blank=True, null=True)),
                ("ultimo_error", models.CharField(blank=True, default="", max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cita",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notificaciones_email",
                        to="agenda.agendacita",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notificaciones_email",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Notificación por email",
                "verbose_name_plural": "Notificaciones por email",
                "ordering": ["-created_at"],
            },
        ),
    ]
