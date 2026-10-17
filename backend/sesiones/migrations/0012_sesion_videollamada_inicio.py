from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sesiones", "0011_cifrar_notas_sesion"),
    ]

    operations = [
        migrations.AddField(
            model_name="sesion",
            name="videollamada_inicio",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
