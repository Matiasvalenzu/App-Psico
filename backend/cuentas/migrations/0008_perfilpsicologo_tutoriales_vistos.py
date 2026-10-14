from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cuentas", "0007_perfilpsicologo_bhe_glosa_default"),
    ]

    operations = [
        migrations.AddField(
            model_name="perfilpsicologo",
            name="tutoriales_vistos",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
