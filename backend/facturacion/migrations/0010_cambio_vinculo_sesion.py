import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("facturacion", "0009_cobro_sesiones"),
        ("sesiones", "0011_cifrar_notas_sesion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CambioVinculoSesion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("numero_sesion", models.PositiveIntegerField(blank=True, null=True)),
                ("accion", models.CharField(choices=[("ASOCIAR", "Asociar"), ("QUITAR", "Quitar")], max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "cobro",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cambios_sesion",
                        to="facturacion.cobro",
                    ),
                ),
                (
                    "sesion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="sesiones.sesion",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
