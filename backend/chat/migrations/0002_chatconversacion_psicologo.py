from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


def assign_legacy_conversations(apps, schema_editor):
    ChatConversacion = apps.get_model("chat", "ChatConversacion")
    user_app, user_model = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(user_app, user_model)

    users = list(User.objects.all()[:2])
    if len(users) == 1:
        ChatConversacion.objects.filter(psicologo__isnull=True).update(
            psicologo=users[0]
        )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("chat", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="chatconversacion",
            name="psicologo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="chat_conversaciones",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(assign_legacy_conversations, migrations.RunPython.noop),
    ]
