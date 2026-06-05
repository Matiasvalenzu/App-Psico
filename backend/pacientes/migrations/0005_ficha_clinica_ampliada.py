from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pacientes", "0004_add_campos_paciente_rut_edad_sexo_ocupacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="paciente",
            name="telefono_whatsapp",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="paciente",
            name="email_contacto",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="paciente",
            name="nacionalidad",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="paciente",
            name="religion",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="paciente",
            name="direccion",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="paciente",
            name="comuna",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="paciente",
            name="prevision",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="paciente",
            name="es_menor_edad",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="paciente",
            name="nombre_tutor",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="paciente",
            name="telefono_tutor",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="paciente",
            name="contacto_emergencia_nombre",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="paciente",
            name="contacto_emergencia_telefono",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="paciente",
            name="origen_consulta",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="paciente",
            name="derivacion_interconsulta",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="paciente",
            name="diagnostico_sospechado",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="paciente",
            name="medicacion_actual",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="paciente",
            name="riesgo_suicida",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="paciente",
            name="ideacion_suicida_nivel",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="paciente",
            name="frecuencia_atencion",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="paciente",
            name="objetivos_intervencion",
            field=models.TextField(blank=True, default=""),
        ),
    ]
