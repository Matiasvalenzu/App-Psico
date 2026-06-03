from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pacientes", "0003_paciente_psicologo"),
    ]

    operations = [
        migrations.AddField(
            model_name="paciente",
            name="rut",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="paciente",
            name="edad",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="paciente",
            name="sexo",
            field=models.CharField(
                blank=True,
                choices=[
                    ("M", "Masculino"),
                    ("F", "Femenino"),
                    ("O", "Otro"),
                    ("N", "No especifica"),
                ],
                default="N",
                max_length=1,
            ),
        ),
        migrations.AddField(
            model_name="paciente",
            name="ocupacion_laboral",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
