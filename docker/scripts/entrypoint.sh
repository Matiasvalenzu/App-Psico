#!/bin/bash
set -e

echo "==> Esperando PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  sleep 1
done

echo "==> Aplicando migraciones..."
python manage.py migrate --noinput

echo "==> Creando superusuario si no existe..."
python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'Admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@psicologo.local')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'Admin')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f'Superusuario creado: {username}')
else:
    print('Superusuario ya existe')
"

echo "==> Recolectando static..."
python manage.py collectstatic --noinput

exec "$@"
