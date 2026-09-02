from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0005_agendacita_boleta_emitida_agendacita_boleta_folio_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="agendaperfilpublico",
            name="instrucciones_reserva",
            field=models.TextField(blank=True, default="", max_length=1500),
        ),
    ]
