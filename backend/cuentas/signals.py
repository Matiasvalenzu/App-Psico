from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import PerfilPsicologo


@receiver(post_save, sender=get_user_model())
def create_psychologist_profile(sender, instance, created, **kwargs):
    if created:
        PerfilPsicologo.objects.create(
            user=instance,
            email_notificaciones=instance.email,
            email_notificaciones_verificado_at=timezone.now() if instance.email else None,
        )
