from django.contrib import admin
from .models import VoiceProfile


@admin.register(VoiceProfile)
class VoiceProfileAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "embedding_model",
        "embedding_dim",
        "sample_count",
        "activo",
        "updated_at",
    ]
    list_filter = ["activo", "embedding_model"]
