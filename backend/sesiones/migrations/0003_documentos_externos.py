import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sesiones", "0002_segmento_embedding"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sesion",
            name="fecha_hora_inicio",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="sesion",
            name="documento_mime_type",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="sesion",
            name="documento_nombre_original",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="sesion",
            name="origen",
            field=models.CharField(
                choices=[
                    ("AUDIO", "Audio"),
                    ("DOCUMENTO_EXTERNO", "Documento externo"),
                ],
                default="AUDIO",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="transcripcionsegmento",
            name="hablante",
            field=models.CharField(
                choices=[
                    ("PSICOLOGO", "Psicólogo"),
                    ("PACIENTE", "Paciente"),
                    ("DOCUMENTO", "Documento"),
                ],
                max_length=20,
            ),
        ),
    ]
