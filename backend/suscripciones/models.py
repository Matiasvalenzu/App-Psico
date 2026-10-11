import math
from datetime import timedelta

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

# Con pago atrasado se puede seguir trabajando mientras Mercado Pago reintenta el cobro.
DIAS_GRACIA_PAGO = 7
# Tras quedar inactiva, la cuenta queda en solo lectura y se elimina pasado este plazo.
DIAS_HASTA_PURGA = 30
ESTADOS_INACTIVOS = ("past_due", "cancelada", "expirada")


class Suscripcion(models.Model):
    ESTADOS = [
        ('trial', 'Periodo de prueba'),
        ('activa', 'Activa'),
        ('past_due', 'Atrasada'),
        ('cancelada', 'Cancelada'),
        ('expirada', 'Expirada'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='suscripcion')
    estado = models.CharField(max_length=20, choices=ESTADOS, default='trial')
    fin_prueba = models.DateTimeField(null=True, blank=True)
    
    mp_preapproval_id = models.CharField(max_length=100, null=True, blank=True)
    mp_payer_id = models.CharField(max_length=100, null=True, blank=True)
    
    card_last_four = models.CharField(max_length=4, null=True, blank=True)
    card_brand = models.CharField(max_length=20, null=True, blank=True)
    proximo_cobro = models.DateTimeField(null=True, blank=True)
    cancelada_en = models.DateTimeField(null=True, blank=True)
    # Desde cuándo la cuenta dejó de estar al día; cuenta los plazos de solo lectura y purga.
    inactiva_desde = models.DateTimeField(null=True, blank=True)
    
    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.estado in ESTADOS_INACTIVOS:
            self.inactiva_desde = self.inactiva_desde or timezone.now()
        else:
            self.inactiva_desde = None
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "estado" in update_fields:
            kwargs["update_fields"] = {*update_fields, "inactiva_desde"}
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.estado}"

    @property
    def is_active_or_trial(self):
        if self.estado == 'activa':
            return True
        if self.estado == 'trial' and self.fin_prueba and timezone.now() < self.fin_prueba:
            return True
        return False

    def expirar_si_vencida(self):
        """Pasa un trial vencido a 'expirada'; el plazo de purga corre desde fin_prueba."""
        if self.estado == "trial" and self.fin_prueba and self.fin_prueba <= timezone.now():
            self.estado = "expirada"
            self.inactiva_desde = self.fin_prueba
            self.save(update_fields=["estado", "actualizada_en"])
            return True
        return False

    @property
    def inicio_inactividad(self):
        if self.estado == "trial":
            if self.fin_prueba and self.fin_prueba <= timezone.now():
                return self.fin_prueba
            return None
        return self.inactiva_desde

    @property
    def puede_escribir(self):
        inicio = self.inicio_inactividad
        if inicio is None:
            return True
        gracia = timedelta(days=DIAS_GRACIA_PAGO if self.estado == "past_due" else 0)
        return timezone.now() < inicio + gracia

    @property
    def fecha_purga(self):
        inicio = self.inicio_inactividad
        return inicio + timedelta(days=DIAS_HASTA_PURGA) if inicio else None

    @property
    def dias_para_purga(self):
        fecha = self.fecha_purga
        if fecha is None:
            return None
        return max(0, math.ceil((fecha - timezone.now()).total_seconds() / 86400))
