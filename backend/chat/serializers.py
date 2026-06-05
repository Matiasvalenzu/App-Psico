from rest_framework import serializers
from pacientes.models import Paciente
from sesiones.models import Sesion
from .models import ChatConversacion, ChatMensaje, InformeIA


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


class InformeIASerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(
        source="paciente.nombre_completo", read_only=True
    )
    psicologo_username = serializers.CharField(source="psicologo.username", read_only=True)
    sesion = serializers.PrimaryKeyRelatedField(
        queryset=Sesion.objects.none(), required=False, allow_null=True
    )
    mensaje_origen = serializers.PrimaryKeyRelatedField(
        queryset=ChatMensaje.objects.none(), required=False, allow_null=True
    )
    contenido = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["paciente"].queryset = Paciente.objects.filter(
                psicologo=request.user
            )
            self.fields["sesion"].queryset = Sesion.objects.filter(
                paciente__psicologo=request.user
            )
            self.fields["mensaje_origen"].queryset = ChatMensaje.objects.filter(
                conversacion__psicologo=request.user,
                rol=ChatMensaje.Rol.ASSISTANT,
            )

    def validate(self, attrs):
        mensaje_origen = attrs.get("mensaje_origen")
        contenido = (attrs.get("contenido") or "").strip()
        paciente = attrs.get("paciente")

        if not mensaje_origen and not contenido:
            raise serializers.ValidationError(
                "Debes indicar un mensaje IA de origen o contenido para el informe."
            )

        if mensaje_origen and paciente and mensaje_origen.conversacion.paciente_id != paciente.id:
            raise serializers.ValidationError(
                "El mensaje de origen no pertenece al paciente seleccionado."
            )

        return attrs

    class Meta:
        model = InformeIA
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "sesion",
            "mensaje_origen",
            "tipo",
            "titulo",
            "contenido",
            "fuentes_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "fuentes_json",
            "created_at",
            "updated_at",
        ]
