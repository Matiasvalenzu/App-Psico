from django.conf import settings
from django.db import migrations


def create_administrador_group(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))

    group, _created = Group.objects.get_or_create(name="Administrador")
    group.permissions.set(Permission.objects.all())

    try:
        user = User.objects.get(username="Admin")
    except User.DoesNotExist:
        return

    user.groups.add(group)
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])


def remove_admin_from_administrador_group(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))

    try:
        group = Group.objects.get(name="Administrador")
        user = User.objects.get(username="Admin")
    except (Group.DoesNotExist, User.DoesNotExist):
        return

    user.groups.remove(group)


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("pacientes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            create_administrador_group,
            remove_admin_from_administrador_group,
        ),
    ]
