from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("facturacion", "0008_envio_boleta"),
        ("sesiones", "0011_cifrar_notas_sesion"),
    ]

    operations = [
        migrations.AddField(
            model_name="cobro",
            name="glosa_incluye_sesion",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="cobro",
            name="sesiones",
            field=models.ManyToManyField(blank=True, related_name="cobros_vinculados", to="sesiones.sesion"),
        ),
    ]
