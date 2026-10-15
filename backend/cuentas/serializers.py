from django.db import transaction
from rest_framework import serializers

from pacientes.documentos import TIPO_RUT, formatear_documento, normalizar_documento

from facturacion.models import DelegacionSII
from facturacion.services import validar_glosa

from .models import PerfilPsicologo

TUTORIALES = {
    "bienvenida",
    "perfil",
    "boletas-config",
    "pacientes",
    "ficha",
    "consentimiento",
    "cobros",
    "sesion-presencial",
    "sesion-virtual",
    "tests",
    "agenda",
    "voz",
    "privacidad",
    "feedback",
}


ONBOARDING_PASOS = {"datos", "voz", "calendario", "consulta", "pacientes", "boletas"}
ONBOARDING_ESTADOS = {"hecho", "omitido"}


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
    tutorial_visto = serializers.BooleanField(required=False)
    tutoriales_vistos = serializers.DictField(required=False)
    onboarding_completado = serializers.BooleanField(required=False)
    onboarding_pasos = serializers.DictField(required=False)
    recordatorios_paciente_activos = serializers.BooleanField(required=False)
    bhe_glosa_default = serializers.CharField(max_length=200, required=False)

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
            "tutorial_visto": instance.tutorial_visto,
            "tutoriales_vistos": instance.tutoriales_vistos or {},
            "onboarding_completado": instance.onboarding_completado,
            "onboarding_pasos": instance.onboarding_pasos or {},
            "recordatorios_paciente_activos": instance.recordatorios_paciente_activos,
            "bhe_glosa_default": instance.bhe_glosa_default,
        }

    def validate_rut_profesional(self, value):
        rut = formatear_documento(TIPO_RUT, normalizar_documento(TIPO_RUT, value)) if value else ""
        if self.instance is not None and rut != self.instance.rut_profesional and (
            DelegacionSII.objects.filter(psicologo_id=self.instance.user_id)
            .exclude(estado=DelegacionSII.Estado.NO_INICIADA)
            .exists()
        ):
            raise serializers.ValidationError(
                "Tu RUT está ligado a la autorización del SII para emitir boletas. Escríbenos si necesitas cambiarlo."
            )
        return rut

    def validate_bhe_glosa_default(self, value):
        return validar_glosa(value)

    def validate_tutoriales_vistos(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Debe ser un objeto.")
        clean = {}
        for key, seen in value.items():
            if key not in TUTORIALES:
                raise serializers.ValidationError("Tutorial no reconocido.")
            if not isinstance(seen, bool):
                raise serializers.ValidationError("Cada valor debe ser verdadero o falso.")
            clean[key] = seen
        return clean

    def validate_onboarding_pasos(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Debe ser un objeto.")
        for key, estado in value.items():
            if key not in ONBOARDING_PASOS:
                raise serializers.ValidationError("Paso no reconocido.")
            if estado not in ONBOARDING_ESTADOS:
                raise serializers.ValidationError("Estado no reconocido.")
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        user = instance.user
        user.first_name = validated_data.pop("first_name", user.first_name).strip()
        user.last_name = validated_data.pop("last_name", user.last_name).strip()
        validated_data.pop("email_notificaciones", None)
        vistos = validated_data.pop("tutoriales_vistos", None)
        pasos = validated_data.pop("onboarding_pasos", None)
        if pasos is not None:
            instance.onboarding_pasos = {**(instance.onboarding_pasos or {}), **pasos}
        user.save(update_fields=["first_name", "last_name"])
        for field, value in validated_data.items():
            setattr(instance, field, value.strip() if isinstance(value, str) else value)
        if vistos is not None:
            merged = dict(instance.tutoriales_vistos or {})
            for key, seen in vistos.items():
                if seen:
                    merged[key] = True
                else:
                    merged.pop(key, None)
            instance.tutoriales_vistos = merged
        if validated_data.get("tutorial_visto") is True or (vistos or {}).get("bienvenida"):
            merged = dict(instance.tutoriales_vistos or {})
            merged["bienvenida"] = True
            instance.tutoriales_vistos = merged
            instance.tutorial_visto = True
        instance.save()
        return instance
