from .base import *

if not os.environ.get("FIELD_ENCRYPTION_KEYS", "").strip():
    raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS es obligatoria en producción.")

# El emisor simulado genera folios falsos: nunca en producción.
if BHE_BACKEND == "fake":
    raise ImproperlyConfigured("BHE_BACKEND=fake no se permite en producción.")

DEBUG = False

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
