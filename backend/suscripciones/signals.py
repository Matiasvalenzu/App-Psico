from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from .models import Suscripcion

User = get_user_model()

@receiver(post_save, sender=User)
def create_suscripcion(sender, instance, created, **kwargs):
    if created:
        Suscripcion.objects.create(
            user=instance,
            estado='trial',
            fin_prueba=timezone.now() + timedelta(days=14)
        )
