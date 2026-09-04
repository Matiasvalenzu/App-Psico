from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cuentas', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CodigoVerificacionRegistro',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(db_index=True, max_length=254, unique=True)),
                ('first_name', models.CharField(blank=True, default='', max_length=150)),
                ('last_name', models.CharField(blank=True, default='', max_length=150)),
                ('password_hash', models.CharField(max_length=128)),
                ('codigo_hash', models.CharField(max_length=64)),
                ('expira_at', models.DateTimeField()),
                ('intentos', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Código de Verificación de Registro',
                'verbose_name_plural': 'Códigos de Verificación de Registro',
            },
        ),
    ]
