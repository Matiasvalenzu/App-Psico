from rest_framework import serializers
from .models import Paciente


class PacienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paciente
        fields = [
            "id",
            "nombre",
            "apellido",
            "nombre_completo",
            "fecha_nacimiento",
            "motivo_consulta",
            "notas_privadas",
            "activo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "nombre_completo", "created_at", "updated_at"]


class PacienteListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paciente
        fields = [
            "id",
            "nombre",
            "apellido",
            "nombre_completo",
            "fecha_nacimiento",
            "activo",
            "updated_at",
        ]
        read_only_fields = ["id", "nombre_completo", "updated_at"]
