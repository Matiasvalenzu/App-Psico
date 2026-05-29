from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()


class VoiceProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="voice_profile")
    embedding_vector = models.JSONField(default=list)
    embedding_model = models.CharField(max_length=120, blank=True, default="")
    embedding_dim = models.PositiveIntegerField(null=True, blank=True)
    sample_count = models.PositiveIntegerField(default=0)
    sample_duration_seconds = models.FloatField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    activo = models.BooleanField(default=True)

    @property
    def is_compatible(self):
        return (
            self.activo
            and self.embedding_model == settings.SPEAKER_EMBEDDING_MODEL
            and bool(self.embedding_vector)
        )

    def __str__(self):
        return f"VoiceProfile - {self.user.username}"
