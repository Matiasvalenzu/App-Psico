from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("voz", "0002_ecapa_voice_profiles"),
        ("sesiones", "0003_documentos_externos"),
    ]

    operations = [
        migrations.AddField(
            model_name="sesion",
            name="psicologo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sesiones_psicologo",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="transcripcionsegmento",
            name="speaker_label",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="transcripcionsegmento",
            name="speaker_match_model",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="transcripcionsegmento",
            name="speaker_match_score",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="transcripcionsegmento",
            name="speaker_match_threshold",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="SpeakerIdentificationResult",
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
                ("pyannote_label", models.CharField(blank=True, default="", max_length=80)),
                ("score", models.FloatField(blank=True, null=True)),
                ("threshold", models.FloatField()),
                (
                    "assigned_hablante",
                    models.CharField(
                        choices=[
                            ("PSICOLOGO", "Psicólogo"),
                            ("PACIENTE", "Paciente"),
                            ("DOCUMENTO", "Documento"),
                        ],
                        default="PACIENTE",
                        max_length=20,
                    ),
                ),
                ("total_duration_seconds", models.FloatField(default=0)),
                ("turn_count", models.PositiveIntegerField(default=0)),
                ("model_name", models.CharField(blank=True, default="", max_length=120)),
                ("reason", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "matched_profile",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="voz.voiceprofile",
                    ),
                ),
                (
                    "sesion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="speaker_results",
                        to="sesiones.sesion",
                    ),
                ),
            ],
            options={
                "ordering": ["sesion", "pyannote_label"],
            },
        ),
    ]
