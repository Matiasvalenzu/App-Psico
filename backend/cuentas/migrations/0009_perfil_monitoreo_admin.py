from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cuentas", "0008_perfilpsicologo_tutoriales_vistos"),
    ]

    operations = [
        migrations.AddField(
            model_name="perfilpsicologo",
            name="ultima_actividad",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="es_interna",
            field=models.BooleanField(
                default=False,
                help_text="Cuenta de prueba interna. No entra en las métricas del panel.",
            ),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="utm_source",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="utm_medium",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="utm_campaign",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="gclid",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="fbclid",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
