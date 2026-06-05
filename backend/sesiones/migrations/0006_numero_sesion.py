from django.db import migrations, models


def backfill_numero_sesion(apps, schema_editor):
    Sesion = apps.get_model("sesiones", "Sesion")
    paciente_ids = (
        Sesion.objects.exclude(origen="DOCUMENTO_EXTERNO")
        .order_by("paciente_id")
        .values_list("paciente_id", flat=True)
        .distinct()
    )

    for paciente_id in paciente_ids:
        sesiones = Sesion.objects.filter(paciente_id=paciente_id).exclude(
            origen="DOCUMENTO_EXTERNO"
        ).order_by("fecha_hora_inicio", "id")
        for numero, sesion in enumerate(sesiones, start=1):
            Sesion.objects.filter(pk=sesion.pk).update(numero_sesion=numero)


class Migration(migrations.Migration):

    dependencies = [
        ("sesiones", "0005_virtual_sessions"),
    ]

    operations = [
        migrations.AddField(
            model_name="sesion",
            name="numero_sesion",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(backfill_numero_sesion, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="sesion",
            name="origen",
            field=models.CharField(
                choices=[
                    ("AUDIO", "Audio"),
                    ("DOCUMENTO_EXTERNO", "Documento externo"),
                    ("VIRTUAL", "Sesión remota"),
                ],
                default="AUDIO",
                max_length=30,
            ),
        ),
    ]
