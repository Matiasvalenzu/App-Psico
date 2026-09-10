from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0002_backfill_existing_subscriptions'),
    ]

    operations = [
        migrations.AddField(
            model_name='suscripcion',
            name='card_brand',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='suscripcion',
            name='card_last_four',
            field=models.CharField(blank=True, max_length=4, null=True),
        ),
        migrations.AddField(
            model_name='suscripcion',
            name='cancelada_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='suscripcion',
            name='proximo_cobro',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
