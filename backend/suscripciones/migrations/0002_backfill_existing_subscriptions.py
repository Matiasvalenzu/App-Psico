from datetime import timedelta

from django.conf import settings
from django.db import migrations
from django.utils import timezone


def create_existing_subscriptions(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Suscripcion = apps.get_model("suscripciones", "Suscripcion")
    trial_end = timezone.now() + timedelta(days=14)

    for user in User.objects.filter(suscripcion__isnull=True):
        Suscripcion.objects.create(
            user_id=user.id,
            estado="trial",
            fin_prueba=trial_end,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("suscripciones", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_existing_subscriptions, migrations.RunPython.noop),
    ]
