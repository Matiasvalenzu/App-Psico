from rest_framework import serializers
from .models import Paciente


class PacienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paciente
        fields = [
            "id",
            "psicologo",
            "nombre",
            "apellido",
            "nombre_completo",
            "fecha_nacimiento",
            "rut",
            "edad",
            "sexo",
            "ocupacion_laboral",
            "motivo_consulta",
            "notas_privadas",
            "activo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "psicologo", "nombre_completo", "created_at", "updated_at"]


class PacienteListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paciente
        fields = [
            "id",
            "psicologo",
            "nombre",
            "apellido",
            "nombre_completo",
            "fecha_nacimiento",
            "rut",
            "edad",
            "sexo",
            "ocupacion_laboral",
            "activo",
            "updated_at",
        ]
        read_only_fields = ["id", "psicologo", "nombre_completo", "updated_at"]
