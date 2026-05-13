from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class VoiceProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="voice_profile")
    embedding_vector = models.JSONField(default=list)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return f"VoiceProfile - {self.user.username}"
