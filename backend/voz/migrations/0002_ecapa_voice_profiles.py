from django.db import migrations, models


def mark_existing_profiles_as_legacy(apps, schema_editor):
    VoiceProfile = apps.get_model("voz", "VoiceProfile")
    VoiceProfile.objects.update(
        activo=False,
        embedding_model="legacy-manual-features",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("voz", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="voiceprofile",
            name="embedding_dim",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="voiceprofile",
            name="embedding_model",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="voiceprofile",
            name="sample_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="voiceprofile",
            name="sample_duration_seconds",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="voiceprofile",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.RunPython(mark_existing_profiles_as_legacy, migrations.RunPython.noop),
    ]
