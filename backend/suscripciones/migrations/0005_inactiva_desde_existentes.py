from django.db import migrations
from django.utils import timezone


def marcar_inactivas(apps, schema_editor):
    """El plazo de 30 días corre desde el deploy: nadie se purga el primer día."""
    Suscripcion = apps.get_model("suscripciones", "Suscripcion")
    ahora = timezone.now()
    Suscripcion.objects.filter(estado="trial", fin_prueba__lt=ahora).update(estado="expirada")
    Suscripcion.objects.filter(
        estado__in=["past_due", "cancelada", "expirada"], inactiva_desde__isnull=True
    ).update(inactiva_desde=ahora)


class Migration(migrations.Migration):
    dependencies = [("suscripciones", "0004_suscripcion_inactiva_desde")]

    operations = [migrations.RunPython(marcar_inactivas, migrations.RunPython.noop)]
