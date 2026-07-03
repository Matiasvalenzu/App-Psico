from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pacientes", "0005_ficha_clinica_ampliada"),
    ]

    operations = [
        migrations.AddField(
            model_name="paciente",
            name="estado",
            field=models.CharField(
                choices=[
                    ("EN_SESION", "En sesión"),
                    ("ALTA", "Alta"),
                    ("ABANDONO", "Abandono"),
                    ("PAUSADO", "Pausado"),
                    ("DERIVADO", "Derivado"),
                ],
                db_index=True,
                default="EN_SESION",
                max_length=20,
            ),
        ),
    ]
