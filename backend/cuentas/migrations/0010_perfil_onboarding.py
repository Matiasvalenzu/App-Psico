from django.db import migrations, models


def marcar_existentes(apps, schema_editor):
    # Quienes ya usan Psiconex no ven el onboarding: es solo para el primer ingreso.
    PerfilPsicologo = apps.get_model("cuentas", "PerfilPsicologo")
    PerfilPsicologo.objects.update(onboarding_completado=True)


class Migration(migrations.Migration):

    dependencies = [
        ("cuentas", "0009_perfil_monitoreo_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="perfilpsicologo",
            name="onboarding_completado",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="perfilpsicologo",
            name="onboarding_pasos",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(marcar_existentes, migrations.RunPython.noop),
    ]
