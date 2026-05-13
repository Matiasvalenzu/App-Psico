from django.db import migrations
from pgvector.django import VectorExtension, VectorField


class Migration(migrations.Migration):
    dependencies = [
        ("sesiones", "0001_initial"),
    ]

    operations = [
        VectorExtension(),
        migrations.AddField(
            model_name="transcripcionsegmento",
            name="embedding",
            field=VectorField(blank=True, dimensions=1024, null=True),
        ),
    ]
