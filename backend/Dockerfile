FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --default-timeout=300 --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data/audio /data/models

EXPOSE 8000

FROM base AS dev

ENV DJANGO_SETTINGS_MODULE=config.settings.development

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM base AS production

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
