from rest_framework import serializers

from .documentos import TIPO_RUT, formatear_documento, normalizar_documento
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
            "tipo_documento",
            "numero_documento",
            "edad",
            "sexo",
            "ocupacion_laboral",
            "motivo_consulta",
            "telefono_whatsapp",
            "email_contacto",
            "nacionalidad",
            "religion",
            "direccion",
            "comuna",
            "prevision",
            "es_menor_edad",
            "nombre_tutor",
            "telefono_tutor",
            "contacto_emergencia_nombre",
            "contacto_emergencia_telefono",
            "origen_consulta",
            "derivacion_interconsulta",
            "diagnostico_sospechado",
            "medicacion_actual",
            "riesgo_suicida",
            "ideacion_suicida_nivel",
            "frecuencia_atencion",
            "objetivos_intervencion",
            "notas_privadas",
            "estado",
            "activo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "psicologo", "nombre_completo", "created_at", "updated_at"]

    def validate(self, attrs):
        tipo = attrs.get("tipo_documento", getattr(self.instance, "tipo_documento", TIPO_RUT))
        numero = attrs.get(
            "numero_documento", getattr(self.instance, "numero_documento", "")
        )
        if numero is None and "rut" in attrs:
            numero = attrs["rut"]
            tipo = TIPO_RUT
        elif "rut" in attrs and "numero_documento" not in attrs:
            numero = attrs["rut"]
            tipo = TIPO_RUT
        if numero:
            normalizado = normalizar_documento(tipo, numero)
            attrs["tipo_documento"] = tipo
            attrs["numero_documento"] = formatear_documento(tipo, normalizado)
            attrs["documento_normalizado"] = normalizado
            if tipo == TIPO_RUT:
                attrs["rut"] = formatear_documento(tipo, normalizado)
            elif "tipo_documento" in attrs or "numero_documento" in attrs:
                attrs["rut"] = ""
        elif "numero_documento" in attrs or "rut" in attrs:
            attrs["numero_documento"] = ""
            attrs["documento_normalizado"] = ""
            attrs["rut"] = ""
        return attrs


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
            "tipo_documento",
            "numero_documento",
            "edad",
            "sexo",
            "ocupacion_laboral",
            "estado",
            "activo",
            "updated_at",
        ]
        read_only_fields = ["id", "psicologo", "nombre_completo", "updated_at"]
