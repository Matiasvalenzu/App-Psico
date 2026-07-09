import hashlib
import re
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers

from pacientes.models import Paciente

from .models import (
    AgendaBloqueo,
    AgendaCita,
    AgendaDisponibilidad,
    AgendaPerfilPublico,
    AgendaReservaPublica,
)


# ─── Serializer interno de citas (autenticado) ──────────────────────

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
            "origen_reserva",
            "reserva_publica_at",
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
            "origen_reserva",
            "reserva_publica_at",
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


# ─── Helpers de normalización ────────────────────────────────────────

def normalizar_rut(rut: str) -> str:
    """Normaliza RUT chileno: quita puntos, guiones, espacios. Deja en mayúscula."""
    if not rut:
        return ""
    return re.sub(r"[\.\-\s]", "", rut).upper().strip()


def normalizar_telefono(tel: str) -> str:
    """Deja solo dígitos y prefijo +."""
    if not tel:
        return ""
    digits = re.sub(r"[^\d+]", "", tel.strip())
    # Normalizar +569... / 569... / 9...
    if digits.startswith("+"):
        return digits
    if digits.startswith("569") and len(digits) >= 11:
        return f"+{digits}"
    if digits.startswith("9") and len(digits) == 9:
        return f"+56{digits}"
    return digits


def normalizar_email(email: str) -> str:
    return email.strip().lower() if email else ""


def ip_hash(request) -> str:
    ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    if not ip:
        ip = request.META.get("REMOTE_ADDR", "")
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


# ─── Serializers públicos ────────────────────────────────────────────

class PerfilPublicoSerializer(serializers.ModelSerializer):
    disponibilidad = serializers.SerializerMethodField()

    class Meta:
        model = AgendaPerfilPublico
        fields = [
            "slug",
            "nombre_publico",
            "subtitulo_publico",
            "descripcion_publica",
            "duracion_minutos",
            "acepta_pacientes_nuevos",
            "disponibilidad",
        ]

    def get_disponibilidad(self, obj):
        bloques = AgendaDisponibilidad.objects.filter(
            psicologo=obj.psicologo, activo=True
        ).values("dia_semana", "hora_inicio", "hora_fin")
        return [
            {
                "dia_semana": b["dia_semana"],
                "hora_inicio": b["hora_inicio"].strftime("%H:%M"),
                "hora_fin": b["hora_fin"].strftime("%H:%M"),
            }
            for b in bloques
        ]


class VerificarPacienteSerializer(serializers.Serializer):
    rut = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    whatsapp = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        rut = normalizar_rut(attrs.get("rut", ""))
        email = normalizar_email(attrs.get("email", ""))
        whatsapp = normalizar_telefono(attrs.get("whatsapp", ""))
        if not rut and not email and not whatsapp:
            raise serializers.ValidationError(
                "Ingresa al menos un dato: RUT, email o WhatsApp."
            )
        attrs["rut"] = rut
        attrs["email"] = email
        attrs["whatsapp"] = whatsapp
        return attrs


class ReservaPublicaSerializer(serializers.Serializer):
    tipo_paciente = serializers.ChoiceField(choices=["EXISTENTE", "NUEVO"])
    inicio = serializers.DateTimeField()

    # Para paciente existente
    paciente_id = serializers.IntegerField(required=False, allow_null=True)

    # Para paciente nuevo
    nombre_completo = serializers.CharField(required=False, allow_blank=True, default="")
    rut = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    whatsapp = serializers.CharField(required=False, allow_blank=True, default="")
    motivo_consulta = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        tipo = attrs["tipo_paciente"]
        if tipo == "EXISTENTE":
            if not attrs.get("paciente_id"):
                raise serializers.ValidationError(
                    {"paciente_id": "Se requiere el ID del paciente."}
                )
        elif tipo == "NUEVO":
            nombre = (attrs.get("nombre_completo") or "").strip()
            if not nombre:
                raise serializers.ValidationError(
                    {"nombre_completo": "El nombre completo es obligatorio."}
                )
            email = normalizar_email(attrs.get("email", ""))
            whatsapp = normalizar_telefono(attrs.get("whatsapp", ""))
            if not email and not whatsapp:
                raise serializers.ValidationError(
                    "Ingresa al menos un dato de contacto: email o WhatsApp."
                )
            attrs["email"] = email
            attrs["whatsapp"] = whatsapp
            attrs["rut"] = normalizar_rut(attrs.get("rut", ""))
        return attrs


# ─── Cálculo de slots ────────────────────────────────────────────────

def calcular_slots(perfil: AgendaPerfilPublico, desde: date, hasta: date) -> list[dict]:
    """Calcula slots disponibles para un perfil público entre dos fechas."""
    psicologo = perfil.psicologo
    duracion = timedelta(minutes=perfil.duracion_minutos)
    ahora = timezone.now()
    min_inicio = ahora + timedelta(hours=perfil.anticipacion_minima_horas)
    max_fecha = (ahora + timedelta(days=perfil.ventana_reserva_dias)).date()

    # Acotar rango
    desde = max(desde, ahora.date())
    hasta = min(hasta, max_fecha)
    if desde > hasta:
        return []

    # Obtener disponibilidad semanal
    disponibilidad = list(
        AgendaDisponibilidad.objects.filter(psicologo=psicologo, activo=True)
    )
    if not disponibilidad:
        return []

    # Obtener citas activas en el rango
    tz = timezone.get_current_timezone()
    rango_inicio = timezone.make_aware(datetime.combine(desde, time.min), tz)
    rango_fin = timezone.make_aware(datetime.combine(hasta, time.max), tz)

    citas_ocupadas = list(
        AgendaCita.objects.filter(
            psicologo=psicologo,
            inicio__lt=rango_fin,
            fin__gt=rango_inicio,
        )
        .exclude(estado=AgendaCita.Estado.ANULADA)
        .values_list("inicio", "fin")
    )

    # Obtener bloqueos
    bloqueos = list(
        AgendaBloqueo.objects.filter(
            psicologo=psicologo,
            inicio__lt=rango_fin,
            fin__gt=rango_inicio,
        ).values_list("inicio", "fin")
    )

    slots = []
    dia_actual = desde
    while dia_actual <= hasta:
        # Lunes=0 en Python weekday()
        dia_semana = dia_actual.weekday()
        bloques_dia = [d for d in disponibilidad if d.dia_semana == dia_semana]

        for bloque in bloques_dia:
            slot_inicio = timezone.make_aware(
                datetime.combine(dia_actual, bloque.hora_inicio), tz
            )
            bloque_fin = timezone.make_aware(
                datetime.combine(dia_actual, bloque.hora_fin), tz
            )

            while slot_inicio + duracion <= bloque_fin:
                slot_fin = slot_inicio + duracion

                # Verificar anticipación mínima
                if slot_inicio < min_inicio:
                    slot_inicio = slot_fin
                    continue

                # Verificar cruce con citas
                cruce_cita = any(
                    c_inicio < slot_fin and c_fin > slot_inicio
                    for c_inicio, c_fin in citas_ocupadas
                )
                if cruce_cita:
                    slot_inicio = slot_fin
                    continue

                # Verificar cruce con bloqueos
                cruce_bloqueo = any(
                    b_inicio < slot_fin and b_fin > slot_inicio
                    for b_inicio, b_fin in bloqueos
                )
                if cruce_bloqueo:
                    slot_inicio = slot_fin
                    continue

                slots.append({
                    "inicio": slot_inicio.isoformat(),
                    "fin": slot_fin.isoformat(),
                })
                slot_inicio = slot_fin

        dia_actual += timedelta(days=1)

    return slots


# ─── Servicio de reserva ─────────────────────────────────────────────

def buscar_paciente_existente(psicologo, rut="", email="", whatsapp=""):
    """Busca paciente activo del psicólogo por RUT, email o WhatsApp."""
    filtros = Q()
    if rut:
        filtros |= Q(rut=rut)
    if email:
        filtros |= Q(email_contacto=email)
    if whatsapp:
        filtros |= Q(telefono_whatsapp=whatsapp)
    if not filtros:
        return None
    return (
        Paciente.objects.filter(filtros, psicologo=psicologo, activo=True)
        .first()
    )


def crear_o_reutilizar_paciente(psicologo, nombre_completo, rut="", email="", whatsapp="", motivo=""):
    """Crea paciente o reutiliza existente si hay coincidencia por RUT/email/WhatsApp."""
    existente = buscar_paciente_existente(psicologo, rut, email, whatsapp)
    if existente:
        return existente, False  # (paciente, es_nuevo)

    partes = nombre_completo.strip().split()
    nombre = partes[0] if partes else "Paciente"
    apellido = " ".join(partes[1:]) if len(partes) > 1 else "Pendiente"

    paciente = Paciente.objects.create(
        psicologo=psicologo,
        nombre=nombre,
        apellido=apellido,
        rut=rut,
        email_contacto=email,
        telefono_whatsapp=whatsapp,
        motivo_consulta=motivo,
        origen_consulta="Reserva pública",
        activo=True,
    )
    return paciente, True


# ─── Serializers internos (autenticados) ─────────────────────────────

class DisponibilidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgendaDisponibilidad
        fields = ["id", "dia_semana", "hora_inicio", "hora_fin", "activo"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        hora_inicio = attrs.get("hora_inicio")
        hora_fin = attrs.get("hora_fin")
        if hora_inicio and hora_fin and hora_inicio >= hora_fin:
            raise serializers.ValidationError(
                {"hora_fin": "La hora de fin debe ser posterior a la hora de inicio."}
            )
        return attrs


class PerfilPublicoInternoSerializer(serializers.ModelSerializer):
    url_reserva = serializers.SerializerMethodField()

    class Meta:
        model = AgendaPerfilPublico
        fields = [
            "id",
            "slug",
            "activo",
            "nombre_publico",
            "subtitulo_publico",
            "descripcion_publica",
            "duracion_minutos",
            "anticipacion_minima_horas",
            "ventana_reserva_dias",
            "acepta_pacientes_nuevos",
            "url_reserva",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "url_reserva", "created_at", "updated_at"]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }

    def get_url_reserva(self, obj):
        base = settings.PUBLIC_APP_URL.rstrip("/")
        return f"{base}/reservar/{obj.slug}"
