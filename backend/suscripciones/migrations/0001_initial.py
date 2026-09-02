# Generated manually
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Suscripcion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('estado', models.CharField(choices=[('trial', 'Periodo de prueba'), ('activa', 'Activa'), ('past_due', 'Atrasada'), ('cancelada', 'Cancelada'), ('expirada', 'Expirada')], default='trial', max_length=20)),
                ('fin_prueba', models.DateTimeField(blank=True, null=True)),
                ('mp_preapproval_id', models.CharField(blank=True, max_length=100, null=True)),
                ('mp_payer_id', models.CharField(blank=True, max_length=100, null=True)),
                ('creada_en', models.DateTimeField(auto_now_add=True)),
                ('actualizada_en', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='suscripcion', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
