from rest_framework import serializers
from .models import ChatConversacion, ChatMensaje


class ChatMensajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMensaje
        fields = ["id", "rol", "contenido", "fuentes_json", "created_at"]
        read_only_fields = ["id", "rol", "created_at"]


class ChatConversacionSerializer(serializers.ModelSerializer):
    mensajes = ChatMensajeSerializer(many=True, read_only=True)
    paciente_nombre = serializers.CharField(
        source="paciente.nombre_completo", read_only=True
    )

    class Meta:
        model = ChatConversacion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "titulo",
            "mensajes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChatConversacionListSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(
        source="paciente.nombre_completo", read_only=True
    )

    class Meta:
        model = ChatConversacion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "titulo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
