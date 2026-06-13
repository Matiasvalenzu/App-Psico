from datetime import timedelta

from rest_framework import serializers

from pacientes.models import Paciente

from .models import AgendaCita


class AgendaCitaSerializer(serializers.ModelSerializer):
    paciente = serializers.PrimaryKeyRelatedField(
        queryset=Paciente.objects.all(),
        required=False,
        allow_null=True,
    )
    paciente_nombre_completo = serializers.SerializerMethodField()
    paciente_telefono_whatsapp = serializers.SerializerMethodField()
    paciente_email_contacto = serializers.SerializerMethodField()

    class Meta:
        model = AgendaCita
        fields = [
            "id",
            "paciente",
            "paciente_nombre_completo",
            "paciente_telefono_whatsapp",
            "paciente_email_contacto",
            "prospecto_nombre",
            "prospecto_apellido",
            "prospecto_email",
            "prospecto_telefono_whatsapp",
            "prospecto_motivo_consulta",
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
            "google_synced_at",
            "google_sync_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "paciente_nombre_completo",
            "paciente_telefono_whatsapp",
            "paciente_email_contacto",
            "fin",
            "grupo_recurrencia",
            "confirmacion_solicitada_at",
            "confirmada_at",
            "google_synced_at",
            "google_sync_error",
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

    def get_paciente_nombre_completo(self, obj):
        if obj.paciente_id and obj.paciente:
            return obj.paciente.nombre_completo
        nombre = f"{obj.prospecto_nombre} {obj.prospecto_apellido}".strip()
        return nombre or "Sin paciente"

    def get_paciente_telefono_whatsapp(self, obj):
        if obj.paciente_id and obj.paciente:
            return obj.paciente.telefono_whatsapp
        return obj.prospecto_telefono_whatsapp

    def get_paciente_email_contacto(self, obj):
        if obj.paciente_id and obj.paciente:
            return obj.paciente.email_contacto
        return obj.prospecto_email

    def validate(self, attrs):
        inicio = attrs.get("inicio") or getattr(self.instance, "inicio", None)
        recurrencia = attrs.get("recurrencia", AgendaCita.Recurrencia.NINGUNA)
        recurrente_hasta = attrs.get("recurrente_hasta")
        paciente = attrs.get("paciente", getattr(self.instance, "paciente", None))
        prospecto_nombre = attrs.get(
            "prospecto_nombre", getattr(self.instance, "prospecto_nombre", "")
        )
        prospecto_apellido = attrs.get(
            "prospecto_apellido", getattr(self.instance, "prospecto_apellido", "")
        )

        if inicio:
            attrs["fin"] = inicio + timedelta(hours=1)

        if not paciente and not (prospecto_nombre and prospecto_apellido):
            raise serializers.ValidationError(
                {"paciente": "Selecciona un paciente o ingresa nombre y apellido del posible paciente."}
            )

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
