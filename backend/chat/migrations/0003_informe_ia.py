import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0002_chatconversacion_psicologo"),
        ("pacientes", "0005_ficha_clinica_ampliada"),
        ("sesiones", "0006_numero_sesion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InformeIA",
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
                            ("RESUMEN_CLINICO", "Resumen clínico"),
                            ("EVOLUCION", "Evolución"),
                            ("PROXIMA_SESION", "Próxima sesión"),
                            ("OTRO", "Otro"),
                        ],
                        default="RESUMEN_CLINICO",
                        max_length=30,
                    ),
                ),
                ("titulo", models.CharField(blank=True, default="", max_length=200)),
                ("contenido", models.TextField()),
                ("fuentes_json", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "mensaje_origen",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="informes_generados",
                        to="chat.chatmensaje",
                    ),
                ),
                (
                    "paciente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="informes_ia",
                        to="pacientes.paciente",
                    ),
                ),
                (
                    "psicologo",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="informes_ia",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "sesion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="informes_ia",
                        to="sesiones.sesion",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
