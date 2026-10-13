from django.utils import timezone
from rest_framework import serializers

from pacientes.documentos import TIPO_RUT, formatear_documento, normalizar_documento
from pacientes.models import Paciente
from sesiones.models import Sesion

from .models import Cobro, DelegacionSII, EmisionBHE
from .services import anulable_hasta, calcular_retencion, plazo_anulacion_vencido, validar_glosa

GLOSA_POR_DEFECTO = "Atención psicológica"
CAMPOS_RECEPTOR = (
    "receptor_tipo_doc", "receptor_documento", "receptor_nombre",
    "receptor_direccion", "receptor_comuna", "receptor_email",
)
# Una boleta emitida no se corrige: se anula en el SII y se emite otra.
CAMPOS_BLOQUEADOS_SI_EMITIDA = ("fecha_pago", "monto_bruto", "glosa", "bhe_modo", *CAMPOS_RECEPTOR)


def snapshot_receptor(paciente):
    """Datos del receptor copiados desde el paciente; nunca incluye información clínica."""
    if paciente.es_menor_edad:
        # La boleta va a nombre del tutor; su RUT se completa a mano antes de emitir.
        return {
            "receptor_tipo_doc": TIPO_RUT,
            "receptor_documento": "",
            "receptor_nombre": paciente.nombre_tutor,
            "receptor_direccion": paciente.direccion,
            "receptor_comuna": paciente.comuna,
            "receptor_email": paciente.email_contacto,
        }
    tipo = paciente.tipo_documento or TIPO_RUT
    numero = paciente.numero_documento or (paciente.rut if tipo == TIPO_RUT else "")
    numero = "".join(c for c in numero.upper() if c.isalnum())
    return {
        "receptor_tipo_doc": tipo,
        "receptor_documento": formatear_documento(tipo, numero),
        "receptor_nombre": paciente.nombre_completo,
        "receptor_direccion": paciente.direccion,
        "receptor_comuna": paciente.comuna,
        "receptor_email": paciente.email_contacto,
    }


class CobroSerializer(serializers.ModelSerializer):
    paciente = serializers.PrimaryKeyRelatedField(
        queryset=Paciente.objects.all(), required=False, allow_null=True
    )
    sesion = serializers.PrimaryKeyRelatedField(
        queryset=Sesion.objects.all(), required=False, allow_null=True
    )
    glosa = serializers.CharField(max_length=200, required=False)
    paciente_nombre = serializers.SerializerMethodField()
    anulable_hasta = serializers.SerializerMethodField()
    plazo_anulacion_vencido = serializers.SerializerMethodField()
    ultima_emision = serializers.SerializerMethodField()

    class Meta:
        model = Cobro
        fields = [
            "id", "paciente", "paciente_nombre", "sesion", "fecha_pago", "monto_bruto",
            "medio_pago", "estado_pago", *CAMPOS_RECEPTOR, "glosa", "bhe_modo",
            "tasa_retencion", "monto_retencion", "monto_liquido", "estado_boleta",
            "boleta_folio", "boleta_fecha_emision", "boleta_anulada_at", "anulable_hasta",
            "plazo_anulacion_vencido", "anulacion_solicitada_at", "ultima_emision", "notas", "created_at", "updated_at",
        ]
        read_only_fields = [
            "tasa_retencion", "monto_retencion", "monto_liquido", "estado_boleta",
            "boleta_folio", "boleta_fecha_emision", "boleta_anulada_at", "anulacion_solicitada_at",
            "created_at", "updated_at",
        ]

    def get_paciente_nombre(self, obj):
        return obj.paciente.nombre_completo if obj.paciente else ""

    def get_anulable_hasta(self, obj):
        return anulable_hasta(obj.boleta_fecha_emision) if obj.boleta_fecha_emision else None

    def get_plazo_anulacion_vencido(self, obj):
        return plazo_anulacion_vencido(obj.boleta_fecha_emision) if obj.boleta_fecha_emision else None

    def get_ultima_emision(self, obj):
        # Recorre la lista ya precargada por la vista en vez de hacer una consulta por cobro.
        emisiones = list(obj.emisiones.all())
        return EmisionBHESerializer(emisiones[0]).data if emisiones else None

    def validate_paciente(self, value):
        if value and value.psicologo_id != self.context["request"].user.id:
            raise serializers.ValidationError("Paciente no encontrado.")
        return value

    def validate_sesion(self, value):
        if value and value.paciente.psicologo_id != self.context["request"].user.id:
            raise serializers.ValidationError("Sesión no encontrada.")
        return value

    def validate_glosa(self, value):
        return validar_glosa(value)

    def validate_monto_bruto(self, value):
        if value <= 0:
            raise serializers.ValidationError("El monto debe ser mayor a cero.")
        return value

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.estado_boleta == Cobro.EstadoBoleta.EN_EMISION:
            cambiados = [
                campo for campo in CAMPOS_BLOQUEADOS_SI_EMITIDA
                if campo in attrs and attrs[campo] != getattr(instance, campo)
            ]
            if cambiados:
                raise serializers.ValidationError("La boleta se está emitiendo en el SII. Espera a que termine.")
        if instance and instance.estado_boleta == Cobro.EstadoBoleta.EMITIDA:
            cambiados = [
                campo for campo in CAMPOS_BLOQUEADOS_SI_EMITIDA
                if campo in attrs and attrs[campo] != getattr(instance, campo)
            ]
            if cambiados:
                raise serializers.ValidationError(
                    "La boleta ya está emitida. Para corregirla, anúlala en el SII y regístrala de nuevo."
                )

        sesion = attrs.get("sesion")
        if sesion:
            paciente = attrs.get("paciente") or (instance.paciente if instance else None)
            if paciente and sesion.paciente_id != paciente.id:
                raise serializers.ValidationError({"sesion": "La sesión no es de este paciente."})
            attrs.setdefault("paciente", sesion.paciente)

        if instance is None:
            if not attrs.get("paciente"):
                raise serializers.ValidationError({"paciente": "Indica el paciente."})
            for campo, valor in snapshot_receptor(attrs["paciente"]).items():
                attrs.setdefault(campo, valor)
            if "glosa" not in attrs:
                perfil = getattr(self.context["request"].user, "perfil_psicologo", None)
                attrs["glosa"] = validar_glosa(
                    getattr(perfil, "bhe_glosa_default", "") or GLOSA_POR_DEFECTO
                )

        tipo = attrs.get("receptor_tipo_doc", getattr(instance, "receptor_tipo_doc", TIPO_RUT))
        documento = attrs.get("receptor_documento")
        if documento:
            attrs["receptor_documento"] = formatear_documento(
                tipo, normalizar_documento(tipo, documento)
            )

        monto = attrs.get("monto_bruto", getattr(instance, "monto_bruto", None))
        fecha = attrs.get("fecha_pago", getattr(instance, "fecha_pago", None))
        tasa, retencion, liquido = calcular_retencion(monto, fecha)
        attrs.update(tasa_retencion=tasa, monto_retencion=retencion, monto_liquido=liquido)
        return attrs


class MarcarEmitidaSerializer(serializers.Serializer):
    folio = serializers.RegexField(r"^\d{1,12}$", error_messages={"invalid": "El folio debe ser numérico."})
    fecha_emision = serializers.DateField(required=False)


# Detalles que pueden traer texto técnico del robot: al psicólogo se le muestra uno genérico.
ERRORES_INTERNOS = {"error_interno", "error_inesperado"}


class EmisionBHESerializer(serializers.ModelSerializer):
    # Sin payload ni evidencias: llevan datos del receptor.
    error_detalle = serializers.SerializerMethodField()
    revision_manual = serializers.SerializerMethodField()
    tiene_pdf = serializers.SerializerMethodField()

    class Meta:
        model = EmisionBHE
        fields = [
            "id", "tipo", "estado", "intentos", "folio", "error_codigo", "error_detalle",
            "revision_manual", "monto_retencion_sii", "monto_liquido_sii", "tiene_pdf",
            "created_at", "finished_at", "resuelta_at",
        ]
        read_only_fields = fields

    def get_error_detalle(self, obj):
        if obj.error_codigo in ERRORES_INTERNOS:
            return "Ocurrió un error interno de Psiconex. Lo estamos revisando."
        return obj.error_detalle

    def get_revision_manual(self, obj):
        return obj.paso == "REVISION_MANUAL"

    def get_tiene_pdf(self, obj):
        return bool(obj.pdf)


class DelegacionSolicitudSerializer(serializers.Serializer):
    acepta = serializers.BooleanField()
    fecha_otorgada = serializers.DateField(required=False)
    # Solo se usa si el perfil todavía no tiene RUT.
    rut = serializers.CharField(max_length=12, required=False, allow_blank=True)
    numero_transaccion = serializers.RegexField(
        r"^\d{1,20}$", required=False, allow_blank=True,
        error_messages={"invalid": "El número de transacción debe tener solo dígitos."},
    )

    def validate_acepta(self, value):
        if not value:
            raise serializers.ValidationError("Debes aceptar las condiciones para autorizar a Psiconex.")
        return value

    def validate_fecha_otorgada(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("La fecha no puede ser futura.")
        return value

    def validate_rut(self, value):
        # Validado aquí para que el error quede asociado al campo «rut».
        if not value:
            return value
        return formatear_documento(TIPO_RUT, normalizar_documento(TIPO_RUT, value))

    def validate(self, attrs):
        perfil = self.context["perfil"]
        rut = perfil.rut_profesional
        if not rut:
            if not attrs.get("rut"):
                raise serializers.ValidationError({"rut": "Indica tu RUT. Quedará fijo en tu perfil."})
            rut = attrs["rut"]
        # Si otra cuenta ya declaró este RUT, podría ser alguien suplantando al psicólogo.
        if DelegacionSII.objects.filter(rut_emisor=rut).exclude(psicologo_id=perfil.user_id).exists():
            raise serializers.ValidationError(
                {"rut": "Este RUT ya está asociado a otra cuenta de Psiconex. Escríbenos para revisarlo."}
            )
        return attrs
