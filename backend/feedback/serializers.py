from django.utils import timezone
from rest_framework import serializers
from .models import FeedbackReport

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif",
    ".pdf", ".txt", ".log", ".mp4", ".mov"
}


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackReport
        fields = [
            "tipo",
            "modulo",
            "severidad",
            "titulo",
            "descripcion",
            "pasos_reproducir",
            "impacto_mejora",
            "archivo_adjunto",
            "url_origen",
            "user_agent",
            "resolucion_pantalla",
        ]

    def validate_archivo_adjunto(self, value):
        if value:
            if value.size > MAX_FILE_SIZE_BYTES:
                raise serializers.ValidationError("El archivo no debe superar los 10 MB.")
            import os
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise serializers.ValidationError(
                    f"Formato no permitido ({ext}). Formatos aceptados: imágenes, PDF, logs o videos cortos."
                )
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            validated_data["usuario"] = request.user
        return super().create(validated_data)


class FeedbackUserListSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    modulo_display = serializers.CharField(source="get_modulo_display", read_only=True)
    severidad_display = serializers.CharField(source="get_severidad_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = FeedbackReport
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "modulo",
            "modulo_display",
            "severidad",
            "severidad_display",
            "titulo",
            "descripcion",
            "pasos_reproducir",
            "impacto_mejora",
            "archivo_adjunto",
            "estado",
            "estado_display",
            "respuesta_admin",
            "created_at",
            "updated_at",
            "resuelto_at",
        ]


class FeedbackAdminListSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    modulo_display = serializers.CharField(source="get_modulo_display", read_only=True)
    severidad_display = serializers.CharField(source="get_severidad_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    usuario_email = serializers.CharField(source="usuario.email", read_only=True)
    usuario_username = serializers.CharField(source="usuario.username", read_only=True)
    respondido_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = FeedbackReport
        fields = [
            "id",
            "usuario_id",
            "usuario_nombre",
            "usuario_email",
            "usuario_username",
            "tipo",
            "tipo_display",
            "modulo",
            "modulo_display",
            "severidad",
            "severidad_display",
            "titulo",
            "descripcion",
            "pasos_reproducir",
            "impacto_mejora",
            "archivo_adjunto",
            "url_origen",
            "user_agent",
            "resolucion_pantalla",
            "estado",
            "estado_display",
            "respuesta_admin",
            "respondido_por_nombre",
            "created_at",
            "updated_at",
            "resuelto_at",
        ]

    def get_usuario_nombre(self, obj):
        full = obj.usuario.get_full_name()
        return full if full else obj.usuario.username

    def get_respondido_por_nombre(self, obj):
        if obj.respondido_por:
            full = obj.respondido_por.get_full_name()
            return full if full else obj.respondido_por.username
        return None


class FeedbackAdminUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackReport
        fields = ["estado", "respuesta_admin"]

    def update(self, instance, validated_data):
        request = self.context.get("request")
        nuevo_estado = validated_data.get("estado", instance.estado)
        
        if nuevo_estado == "resuelto" and instance.estado != "resuelto":
            instance.resuelto_at = timezone.now()
        elif nuevo_estado != "resuelto":
            instance.resuelto_at = None

        if request and hasattr(request, "user") and request.user.is_authenticated:
            instance.respondido_por = request.user

        return super().update(instance, validated_data)
