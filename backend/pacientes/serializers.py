from rest_framework import serializers

from .documentos import TIPO_RUT, formatear_documento, normalizar_documento
from .models import Paciente, ConsentimientoInformado


class PacienteSerializer(serializers.ModelSerializer):
    consentimiento_estado = serializers.SerializerMethodField()
    consentimiento_id = serializers.SerializerMethodField()
    consentimiento_fecha_firma = serializers.SerializerMethodField()

    def get_consentimiento_estado(self, obj):
        latest = obj.consentimientos.first()
        return latest.estado if latest else None

    def get_consentimiento_id(self, obj):
        latest = obj.consentimientos.first()
        return latest.id if latest else None

    def get_consentimiento_fecha_firma(self, obj):
        latest = obj.consentimientos.first()
        return latest.fecha_firma if latest else None

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
            "consentimiento_estado",
            "consentimiento_id",
            "consentimiento_fecha_firma",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "psicologo",
            "nombre_completo",
            "consentimiento_estado",
            "consentimiento_id",
            "consentimiento_fecha_firma",
            "created_at",
            "updated_at",
        ]

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


class ConsentimientoInformadoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    psicologo_nombre = serializers.SerializerMethodField()

    def get_psicologo_nombre(self, obj):
        return obj.psicologo.get_full_name() or obj.psicologo.username

    class Meta:
        model = ConsentimientoInformado
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_nombre",
            "titulo",
            "contenido",
            "estado",
            "enlace_firma",
            "email_destino",
            "email_enviado",
            "email_error",
            "fecha_envio",
            "fecha_firma",
            "firma_nombre",
            "firma_rut",
            "firma_imagen",
            "firma_ip",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "psicologo",
            "enlace_firma",
            "fecha_firma",
            "firma_ip",
            "created_at",
            "updated_at",
        ]


class CrearConsentimientoSerializer(serializers.Serializer):
    contenido = serializers.CharField(required=True)
    titulo = serializers.CharField(required=False, default="Consentimiento Informado para Atención Psicológica")
    email_destino = serializers.EmailField(required=False, allow_blank=True)
    enviar_email = serializers.BooleanField(default=False)


class PublicConsentimientoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    paciente_rut = serializers.CharField(source="paciente.rut", read_only=True)
    paciente_email = serializers.CharField(source="paciente.email_contacto", read_only=True)
    psicologo_nombre = serializers.SerializerMethodField()
    psicologo_especialidad = serializers.SerializerMethodField()

    def get_psicologo_nombre(self, obj):
        return obj.psicologo.get_full_name() or obj.psicologo.username

    def get_psicologo_especialidad(self, obj):
        return getattr(obj.psicologo, "especialidad_clinica", "Psicología Clínica")

    class Meta:
        model = ConsentimientoInformado
        fields = [
            "id",
            "titulo",
            "contenido",
            "estado",
            "paciente_nombre",
            "paciente_rut",
            "paciente_email",
            "psicologo_nombre",
            "psicologo_especialidad",
            "fecha_envio",
            "fecha_firma",
            "firma_nombre",
            "firma_rut",
            "firma_imagen",
        ]


class FirmarConsentimientoSerializer(serializers.Serializer):
    firma_nombre = serializers.CharField(required=True, max_length=200)
    firma_rut = serializers.CharField(required=True, max_length=30)
    firma_imagen = serializers.CharField(required=False, allow_blank=True)
    acepta_terminos = serializers.BooleanField(required=True)

    def validate_acepta_terminos(self, value):
        if not value:
            raise serializers.ValidationError("Debe aceptar los términos del consentimiento informado.")
        return value

