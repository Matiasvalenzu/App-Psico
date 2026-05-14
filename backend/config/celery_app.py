import os
from pathlib import Path

from dotenv import load_dotenv
from celery import Celery

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env", override=True)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

app = Celery("psicologo")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
