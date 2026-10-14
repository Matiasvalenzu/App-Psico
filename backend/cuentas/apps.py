from django.apps import AppConfig


class CuentasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cuentas"

    def ready(self):
        import cuentas.signals  # noqa: F401
        from cuentas.actividad import install_jwt_login_hooks

        install_jwt_login_hooks()
