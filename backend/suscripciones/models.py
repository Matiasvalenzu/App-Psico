from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

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

    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.estado}"

    @property
    def is_active_or_trial(self):
        if self.estado == 'activa':
            return True
        if self.estado == 'trial' and self.fin_prueba and timezone.now() < self.fin_prueba:
            return True
        return False
