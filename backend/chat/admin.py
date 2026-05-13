from django.contrib import admin
from .models import ChatConversacion, ChatMensaje


@admin.register(ChatConversacion)
class ChatConversacionAdmin(admin.ModelAdmin):
    list_display = ["paciente", "titulo", "created_at", "updated_at"]
    search_fields = ["paciente__nombre", "paciente__apellido", "titulo"]


@admin.register(ChatMensaje)
class ChatMensajeAdmin(admin.ModelAdmin):
    list_display = ["conversacion", "rol", "contenido_truncado", "created_at"]
    list_filter = ["rol"]

    def contenido_truncado(self, obj):
        return obj.contenido[:80]
