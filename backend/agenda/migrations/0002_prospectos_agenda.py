from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="agendacita",
            name="paciente",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="agenda_citas",
                to="pacientes.paciente",
            ),
        ),
        migrations.AddField(
            model_name="agendacita",
            name="prospecto_nombre",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="agendacita",
            name="prospecto_apellido",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="agendacita",
            name="prospecto_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="agendacita",
            name="prospecto_telefono_whatsapp",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="agendacita",
            name="prospecto_motivo_consulta",
            field=models.TextField(blank=True, default=""),
        ),
    ]
