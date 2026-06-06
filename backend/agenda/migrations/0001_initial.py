# Generated manually for agenda MVP.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("pacientes", "0005_ficha_clinica_ampliada"),
    ]

    operations = [
        migrations.CreateModel(
            name="AgendaCita",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("inicio", models.DateTimeField(db_index=True)),
                ("fin", models.DateTimeField(db_index=True)),
                ("estado", models.CharField(choices=[("PROGRAMADA", "Programada"), ("CONFIRMACION_SOLICITADA", "Confirmación solicitada"), ("CONFIRMADA", "Confirmada"), ("ANULADA", "Anulada")], db_index=True, default="PROGRAMADA", max_length=30)),
                ("notas", models.TextField(blank=True, default="")),
                ("motivo_anulacion", models.TextField(blank=True, default="")),
                ("recurrencia", models.CharField(choices=[("NINGUNA", "Sin recurrencia"), ("SEMANAL", "Semanal"), ("QUINCENAL", "Cada dos semanas")], default="NINGUNA", max_length=20)),
                ("recurrente_hasta", models.DateField(blank=True, null=True)),
                ("grupo_recurrencia", models.UUIDField(blank=True, db_index=True, null=True)),
                ("confirmacion_solicitada_at", models.DateTimeField(blank=True, null=True)),
                ("confirmada_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("paciente", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agenda_citas", to="pacientes.paciente")),
                ("psicologo", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agenda_citas", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["inicio"],
            },
        ),
    ]
