from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_existing_patients_to_admin(apps, schema_editor):
    Paciente = apps.get_model("pacientes", "Paciente")
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))

    admin = User.objects.filter(username="Admin").first()
    if admin is None:
        admin = User.objects.filter(is_superuser=True).order_by("id").first()
    if admin is None:
        admin = User.objects.order_by("id").first()

    if admin is not None:
        Paciente.objects.filter(psicologo__isnull=True).update(psicologo=admin)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("pacientes", "0002_create_administrador_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="paciente",
            name="psicologo",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pacientes",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            assign_existing_patients_to_admin,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="paciente",
            name="psicologo",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pacientes",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
