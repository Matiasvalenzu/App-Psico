import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR.parent / ".env", override=True)


def env_bool(name, default=False):
    value = os.environ.get(name, str(default))
    return value.strip().lower() in {"1", "true", "yes", "on"}

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "dev-secret-change-me-minimum-32-characters"
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    # Local apps
    "pacientes",
    "sesiones",
    "voz",
    "chat",
    "evaluaciones",
    "agenda",
    "suscripciones",
    "notificaciones",
    "cuentas",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "psicologo"),
        "USER": os.environ.get("POSTGRES_USER", "psicologo"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "change-me"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "es"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# Simple JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=4),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

# Orígenes adicionales para la extensión Chrome (Meet y Zoom)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://meet\.google\.com$",
    r"^https://.*\.zoom\.us$",
    r"^https://zoom\.us$",
    r"^chrome-extension://.*$",
]

# Celery
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Santiago"
CELERY_TASK_ROUTES = {
    "notificaciones.tasks.send_notification": {"queue": "email"},
    "notificaciones.tasks.dispatch_pending_notifications": {"queue": "email"},
}
CELERY_BEAT_SCHEDULE = {
    "dispatch-pending-email-notifications": {
        "task": "notificaciones.tasks.dispatch_pending_notifications",
        "schedule": 60.0,
    },
}

# Audio storage
AUDIO_STORAGE_PATH = os.environ.get("AUDIO_STORAGE_PATH", "/data/audio")

# Document upload
DOCUMENT_UPLOAD_MAX_BYTES = int(
    os.environ.get("DOCUMENT_UPLOAD_MAX_BYTES", str(10 * 1024 * 1024))
)

# DeepSeek
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# Public links and psychological tests
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "http://localhost:3000")
TEST_LINK_EXPIRATION_DAYS = int(os.environ.get("TEST_LINK_EXPIRATION_DAYS", "7"))
DSM5_DOCUMENT_PATH = os.environ.get(
    "DSM5_DOCUMENT_PATH",
    "/app/informes/dsm5-manualdiagnsticoyestadisticodelostrastornosmentales-161006005112.pdf",
)

# Transactional email delivery through Brevo SMTP.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "15"))
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@datnexia.com")
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Psiconex")
EMAIL_SUPPORT_ADDRESS = os.environ.get(
    "EMAIL_SUPPORT_ADDRESS", "psiconex@datnexia.com"
)
EMAIL_LOGO_URL = os.environ.get(
    "EMAIL_LOGO_URL", f"{PUBLIC_APP_URL.rstrip('/')}/logo-psiconex.png"
)

if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured("EMAIL_USE_TLS y EMAIL_USE_SSL no pueden estar activos a la vez.")

# Google Calendar sync
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_CALENDAR_REDIRECT_URI = os.environ.get("GOOGLE_CALENDAR_REDIRECT_URI", "")
GOOGLE_CALENDAR_RETURN_URL = os.environ.get("GOOGLE_CALENDAR_RETURN_URL", PUBLIC_APP_URL)
GOOGLE_CALENDAR_NAME = os.environ.get("GOOGLE_CALENDAR_NAME", "Agenda Psicológica")

# Audio AI pipeline
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
PYANNOTE_AUTH_TOKEN = os.environ.get("PYANNOTE_AUTH_TOKEN", "")
PYANNOTE_API_BASE_URL = os.environ.get("PYANNOTE_API_BASE_URL", "https://api.pyannote.ai")
PYANNOTE_API_MODEL = os.environ.get("PYANNOTE_API_MODEL", "precision-2")
PYANNOTE_API_TIMEOUT_SECONDS = int(os.environ.get("PYANNOTE_API_TIMEOUT_SECONDS", "3600"))
PYANNOTE_API_POLL_INTERVAL_SECONDS = float(
    os.environ.get("PYANNOTE_API_POLL_INTERVAL_SECONDS", "10")
)
PYANNOTE_API_REQUEST_TIMEOUT_SECONDS = int(
    os.environ.get("PYANNOTE_API_REQUEST_TIMEOUT_SECONDS", "60")
)
PYANNOTE_API_UPLOAD_TIMEOUT_SECONDS = int(
    os.environ.get("PYANNOTE_API_UPLOAD_TIMEOUT_SECONDS", "300")
)
VOICE_MATCH_THRESHOLD = float(os.environ.get("VOICE_MATCH_THRESHOLD", "0.65"))
SPEAKER_EMBEDDING_MODEL = os.environ.get(
    "SPEAKER_EMBEDDING_MODEL", "speechbrain/spkrec-ecapa-voxceleb"
)
SPEAKER_EMBEDDING_CACHE_DIR = os.environ.get(
    "SPEAKER_EMBEDDING_CACHE_DIR", "/data/models/speechbrain"
)
SPEAKER_EMBEDDING_DEVICE = os.environ.get("SPEAKER_EMBEDDING_DEVICE", "cpu")
SPEAKER_MATCH_THRESHOLD = float(os.environ.get("SPEAKER_MATCH_THRESHOLD", "0.35"))
SPEAKER_MATCH_MARGIN = float(os.environ.get("SPEAKER_MATCH_MARGIN", "0.05"))
SPEAKER_MIN_TURN_SECONDS = float(os.environ.get("SPEAKER_MIN_TURN_SECONDS", "1.0"))
SPEAKER_MIN_TOTAL_SECONDS = float(os.environ.get("SPEAKER_MIN_TOTAL_SECONDS", "3.0"))
SPEAKER_MAX_SECONDS_PER_LABEL = float(
    os.environ.get("SPEAKER_MAX_SECONDS_PER_LABEL", "30.0")
)
EMBEDDING_DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "1024"))
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "intfloat/multilingual-e5-large")
EMBEDDING_USE_MODEL = os.environ.get("EMBEDDING_USE_MODEL", "False").lower() == "true"

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")
MERCADOPAGO_WEBHOOK_SECRET = os.environ.get("MERCADOPAGO_WEBHOOK_SECRET", "")
