from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.utils import timezone

LOGIN_INTERVALO = timedelta(hours=1)
ACTIVIDAD_INTERVALO = timedelta(minutes=15)
ATRIBUCION_CAMPOS = ("utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid")
_JWT_HOOKS = False


def cuentas_medibles():
    User = get_user_model()
    return User.objects.filter(is_superuser=False).exclude(perfil_psicologo__es_interna=True)


def cuenta_exenta(user):
    if not user or not getattr(user, "pk", None):
        return False
    if user.is_superuser:
        return True
    perfil = getattr(user, "perfil_psicologo", None)
    if perfil is None:
        from .models import PerfilPsicologo

        perfil = PerfilPsicologo.objects.filter(user_id=user.pk).only("es_interna").first()
    return bool(perfil and perfil.es_interna)


def registrar_login(user):
    if user is None or not getattr(user, "pk", None):
        return
    ahora = timezone.now()
    if not user.last_login or ahora - user.last_login >= LOGIN_INTERVALO:
        update_last_login(None, user)
    registrar_actividad(user)


def registrar_actividad(user):
    if user is None or not getattr(user, "pk", None):
        return
    if getattr(user, "is_authenticated", True) is False:
        return
    from .models import PerfilPsicologo

    ahora = timezone.now()
    perfil = (
        PerfilPsicologo.objects.filter(user_id=user.pk)
        .only("id", "ultima_actividad")
        .first()
    )
    if perfil is None:
        perfil = PerfilPsicologo.objects.create(
            user=user,
            email_notificaciones=getattr(user, "email", "") or "",
        )
    if perfil.ultima_actividad and ahora - perfil.ultima_actividad < ACTIVIDAD_INTERVALO:
        return
    PerfilPsicologo.objects.filter(pk=perfil.pk).update(ultima_actividad=ahora)


def aplicar_atribucion(user, data):
    if user is None or not data:
        return
    from .models import PerfilPsicologo

    perfil = PerfilPsicologo.objects.filter(user_id=user.pk).first()
    if perfil is None:
        perfil = PerfilPsicologo.objects.create(
            user=user,
            email_notificaciones=getattr(user, "email", "") or "",
        )
    changed = []
    for field in ATRIBUCION_CAMPOS:
        value = str(data.get(field) or "").strip()[:200]
        if value and not getattr(perfil, field):
            setattr(perfil, field, value)
            changed.append(field)
    if changed:
        perfil.save(update_fields=changed)


def install_jwt_login_hooks():
    global _JWT_HOOKS
    if _JWT_HOOKS:
        return
    _JWT_HOOKS = True

    from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.views import TokenRefreshView

    original_validate = TokenObtainPairSerializer.validate

    def validate(self, attrs):
        data = original_validate(self, attrs)
        registrar_login(self.user)
        return data

    TokenObtainPairSerializer.validate = validate

    original_post = TokenRefreshView.post

    def post(self, request, *args, **kwargs):
        user_id = None
        raw = ""
        try:
            raw = request.data.get("refresh") or ""
        except Exception:
            raw = ""
        if raw:
            try:
                user_id = RefreshToken(raw).get("user_id")
            except Exception:
                user_id = None
        response = original_post(self, request, *args, **kwargs)
        if getattr(response, "status_code", None) == 200 and user_id:
            user = get_user_model().objects.filter(pk=user_id).first()
            registrar_login(user)
        return response

    TokenRefreshView.post = post
