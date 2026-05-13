from django.contrib import admin
from .models import VoiceProfile


@admin.register(VoiceProfile)
class VoiceProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "fecha_creacion", "activo"]
    list_filter = ["activo"]
