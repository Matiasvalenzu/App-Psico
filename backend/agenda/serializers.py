from datetime import timedelta

from rest_framework import serializers

from pacientes.models import Paciente

from .models import AgendaCita


class AgendaCitaSerializer(serializers.ModelSerializer):
    paciente_nombre_completo = serializers.CharField(
        source="paciente.nombre_completo",
        read_only=True,
    )
    paciente_telefono_whatsapp = serializers.CharField(
        source="paciente.telefono_whatsapp",
        read_only=True,
    )

    class Meta:
        model = AgendaCita
        fields = [
            "id",
            "paciente",
            "paciente_nombre_completo",
            "paciente_telefono_whatsapp",
            "inicio",
            "fin",
            "estado",
            "notas",
            "motivo_anulacion",
            "recurrencia",
            "recurrente_hasta",
            "grupo_recurrencia",
            "confirmacion_solicitada_at",
            "confirmada_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "paciente_nombre_completo",
            "paciente_telefono_whatsapp",
            "fin",
            "grupo_recurrencia",
            "confirmacion_solicitada_at",
            "confirmada_at",
            "created_at",
            "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["paciente"].queryset = Paciente.objects.filter(
                psicologo=request.user,
                activo=True,
            )

    def validate(self, attrs):
        inicio = attrs.get("inicio") or getattr(self.instance, "inicio", None)
        recurrencia = attrs.get("recurrencia", AgendaCita.Recurrencia.NINGUNA)
        recurrente_hasta = attrs.get("recurrente_hasta")

        if inicio:
            attrs["fin"] = inicio + timedelta(hours=1)

        if self.instance:
            return attrs

        if recurrencia != AgendaCita.Recurrencia.NINGUNA:
            if not recurrente_hasta:
                raise serializers.ValidationError(
                    {"recurrente_hasta": "Indica hasta cuándo repetir la cita."}
                )
            if inicio and recurrente_hasta < inicio.date():
                raise serializers.ValidationError(
                    {"recurrente_hasta": "La fecha final debe ser posterior al inicio."}
                )
            if inicio and recurrente_hasta > inicio.date() + timedelta(days=365):
                raise serializers.ValidationError(
                    {"recurrente_hasta": "La recurrencia no puede superar 12 meses."}
                )

        return attrs
