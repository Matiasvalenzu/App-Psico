from rest_framework import serializers
from pacientes.models import Paciente
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
    psicologo_username = serializers.CharField(source="psicologo.username", read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["paciente"].queryset = Paciente.objects.filter(
                psicologo=request.user
            )

    class Meta:
        model = ChatConversacion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "titulo",
            "mensajes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "psicologo", "psicologo_username", "created_at", "updated_at"]


class ChatConversacionListSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(
        source="paciente.nombre_completo", read_only=True
    )
    psicologo_username = serializers.CharField(source="psicologo.username", read_only=True)
    mensajes_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ChatConversacion
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "titulo",
            "mensajes_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "psicologo",
            "psicologo_username",
            "mensajes_count",
            "created_at",
            "updated_at",
        ]
