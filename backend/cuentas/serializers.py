from django.db import transaction
from rest_framework import serializers

from pacientes.documentos import TIPO_RUT, formatear_documento, normalizar_documento

from .models import PerfilPsicologo


class PerfilPsicologoSerializer(serializers.Serializer):
    login_email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    last_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    full_name = serializers.CharField(read_only=True)
    email_notificaciones = serializers.EmailField(required=False)
    email_notificaciones_efectivo = serializers.EmailField(read_only=True)
    email_notificaciones_pendiente = serializers.EmailField(read_only=True)
    email_notificaciones_verificado = serializers.BooleanField(read_only=True)
    rut_profesional = serializers.CharField(max_length=12, allow_blank=True, required=False)
    especialidad_clinica = serializers.CharField(max_length=180, allow_blank=True, required=False)
    registro_profesional = serializers.CharField(max_length=80, allow_blank=True, required=False)
    telefono_profesional = serializers.CharField(max_length=30, allow_blank=True, required=False)
    modalidad_atencion = serializers.ChoiceField(
        choices=PerfilPsicologo.Modalidad.choices, required=False
    )
    comuna = serializers.CharField(max_length=100, allow_blank=True, required=False)
    direccion_consulta = serializers.CharField(max_length=255, allow_blank=True, required=False)

    def to_representation(self, instance):
        return {
            "login_email": instance.user.email,
            "first_name": instance.user.first_name,
            "last_name": instance.user.last_name,
            "full_name": instance.user.get_full_name(),
            "email_notificaciones": instance.email_notificaciones,
            "email_notificaciones_efectivo": instance.email_notificaciones_efectivo,
            "email_notificaciones_pendiente": instance.email_notificaciones_pendiente,
            "email_notificaciones_verificado": bool(
                instance.email_notificaciones_verificado_at
            ),
            "rut_profesional": instance.rut_profesional,
            "especialidad_clinica": instance.especialidad_clinica,
            "registro_profesional": instance.registro_profesional,
            "telefono_profesional": instance.telefono_profesional,
            "modalidad_atencion": instance.modalidad_atencion,
            "comuna": instance.comuna,
            "direccion_consulta": instance.direccion_consulta,
        }

    def validate_rut_profesional(self, value):
        if not value:
            return ""
        normalized = normalizar_documento(TIPO_RUT, value)
        return formatear_documento(TIPO_RUT, normalized)

    @transaction.atomic
    def update(self, instance, validated_data):
        user = instance.user
        user.first_name = validated_data.pop("first_name", user.first_name).strip()
        user.last_name = validated_data.pop("last_name", user.last_name).strip()
        validated_data.pop("email_notificaciones", None)
        user.save(update_fields=["first_name", "last_name"])
        for field, value in validated_data.items():
            setattr(instance, field, value.strip() if isinstance(value, str) else value)
        instance.save()
        return instance
