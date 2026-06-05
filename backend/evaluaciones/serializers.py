from rest_framework import serializers

from pacientes.models import Paciente

from .catalog import ELLIS_SLUG, get_test, list_tests, without_scoring
from .models import EvaluacionAsignada, ResultadoEvaluacion


class CrearEvaluacionAsignadaSerializer(serializers.Serializer):
    paciente = serializers.PrimaryKeyRelatedField(queryset=Paciente.objects.all())
    test_slug = serializers.CharField(default=ELLIS_SLUG)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["paciente"].queryset = Paciente.objects.filter(
                psicologo=request.user,
                activo=True,
            )

    def validate_test_slug(self, value):
        if not get_test(value):
            raise serializers.ValidationError("Test no disponible.")
        return value

    def validate_paciente(self, paciente):
        if not paciente.email_contacto:
            raise serializers.ValidationError(
                "El paciente no tiene correo de contacto registrado."
            )
        return paciente


class ResultadoEvaluacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultadoEvaluacion
        fields = [
            "id",
            "respuestas",
            "puntajes",
            "interpretacion",
            "observacion_ia",
            "estado_ia",
            "error_ia",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EvaluacionAsignadaSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source="paciente.nombre_completo", read_only=True)
    psicologo_username = serializers.CharField(source="psicologo.username", read_only=True)
    test_nombre = serializers.SerializerMethodField()
    resultado = ResultadoEvaluacionSerializer(read_only=True)

    class Meta:
        model = EvaluacionAsignada
        fields = [
            "id",
            "paciente",
            "paciente_nombre",
            "psicologo",
            "psicologo_username",
            "sesion",
            "test_slug",
            "test_nombre",
            "enlace_generado",
            "email_destino",
            "mensaje_email",
            "estado",
            "email_enviado",
            "email_error",
            "fecha_envio",
            "fecha_expiracion",
            "fecha_completado",
            "resultado",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_test_nombre(self, obj):
        test = get_test(obj.test_slug)
        return test["name"] if test else obj.test_slug


class PublicSubmitSerializer(serializers.Serializer):
    respuestas = serializers.DictField(child=serializers.CharField())


def public_test_payload(asignacion):
    test = without_scoring(get_test(asignacion.test_slug))
    return {
        "estado": asignacion.estado,
        "paciente_nombre": asignacion.paciente.nombre,
        "fecha_expiracion": asignacion.fecha_expiracion,
        "test": test,
    }


def catalog_payload(slug=None):
    if slug:
        test = get_test(slug)
        return without_scoring(test) if test else None
    return list_tests()
