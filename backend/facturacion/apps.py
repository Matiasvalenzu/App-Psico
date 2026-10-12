from django.apps import AppConfig


class FacturacionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "facturacion"
    verbose_name = "Cobros y boletas de honorarios"

    def ready(self):
        from .logs import instalar

        instalar()
