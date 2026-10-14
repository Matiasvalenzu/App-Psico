import csv
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, Lower, TruncWeek
from django.utils import timezone

from agenda.models import AgendaCita
from chat.models import ChatMensaje, InformeIA
from evaluaciones.models import EvaluacionAsignada
from facturacion.models import EmisionBHE
from pacientes.models import Paciente
from sesiones.models import Sesion
from suscripciones.models import PLANES, PagoPlusPendiente, Suscripcion

from .actividad import cuentas_medibles
from .models import PerfilPsicologo, RegistroConsumoIA

User = get_user_model()
PAGE_SIZE = 25


def _ahora():
    return timezone.localtime()


def _inicio_dia(momento=None):
    momento = _ahora() if momento is None else timezone.localtime(momento)
    return momento.replace(hour=0, minute=0, second=0, microsecond=0)


def _inicio_mes(momento=None):
    return _inicio_dia(momento).replace(day=1)


def _lunes_semana(momento=None):
    dia = _inicio_dia(momento)
    return dia - timedelta(days=dia.weekday())


def _iso(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return timezone.localtime(value).isoformat()


def _mes_key(value):
    local = timezone.localtime(value)
    return f"{local.year:04d}-{local.month:02d}"


def _meses(n=6):
    cursor = _inicio_mes()
    meses = []
    for _ in range(n):
        meses.append(cursor)
        cursor = (cursor - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return list(reversed(meses))


def _semanas(n=12):
    cursor = _lunes_semana()
    return [cursor - timedelta(weeks=n - 1 - i) for i in range(n)]


def _subconteo(queryset, group_field):
    return Coalesce(
        Subquery(
            queryset.values(group_field).annotate(c=Count("pk")).values("c")[:1],
            output_field=IntegerField(),
        ),
        Value(0),
    )


def _subsuma(queryset, group_field, sum_field):
    return Coalesce(
        Subquery(
            queryset.values(group_field).annotate(s=Sum(sum_field)).values("s")[:1],
            output_field=IntegerField(),
        ),
        Value(0),
    )


def _subsuma_decimal(queryset, group_field, sum_field):
    campo = DecimalField(max_digits=14, decimal_places=6)
    return Coalesce(
        Subquery(
            queryset.values(group_field).annotate(s=Sum(sum_field)).values("s")[:1],
            output_field=campo,
        ),
        Value(0, output_field=campo),
        output_field=campo,
    )


def _dias_prueba(suscripcion, ahora):
    if not suscripcion or suscripcion.estado != "trial" or not suscripcion.fin_prueba:
        return None
    delta = suscripcion.fin_prueba - ahora
    if delta.total_seconds() <= 0:
        return 0
    return delta.days + (1 if delta.seconds or delta.microseconds else 0)


def _nombre(user):
    return " ".join(part for part in (user.first_name, user.last_name) if part).strip()


def _emails_duplicados():
    return set(
        User.objects.exclude(email="")
        .annotate(email_norm=Lower("email"))
        .values("email_norm")
        .annotate(c=Count("id"))
        .filter(c__gt=1)
        .values_list("email_norm", flat=True)
    )


def _anotar_uso(qs, inicio_mes):
    sesiones = Sesion.objects.filter(paciente__psicologo_id=OuterRef("pk"))
    sesiones_mes = sesiones.filter(fecha_hora_inicio__gte=inicio_mes)
    return qs.annotate(
        pacientes_count=_subconteo(
            Paciente.objects.filter(psicologo_id=OuterRef("pk")),
            "psicologo_id",
        ),
        sesiones_mes=_subconteo(sesiones_mes, "paciente__psicologo_id"),
        audio_segundos=_subsuma(sesiones, "paciente__psicologo_id", "duracion_segundos"),
        tokens_total=_subsuma(
            RegistroConsumoIA.objects.filter(user_id=OuterRef("pk")),
            "user_id",
            "tokens_total",
        ),
        costo_ia=_subsuma_decimal(
            RegistroConsumoIA.objects.filter(user_id=OuterRef("pk")),
            "user_id",
            "costo_estimado_usd",
        ),
    )


def _fila_usuario(user, duplicados, ahora):
    perfil = getattr(user, "perfil_psicologo", None)
    suscripcion = getattr(user, "suscripcion", None)
    exenta = user.is_superuser or bool(perfil and perfil.es_interna)
    estado = suscripcion.estado if suscripcion else "trial"
    email = user.email or ""
    audio_segundos = int(getattr(user, "audio_segundos", 0) or 0)
    costo = float(getattr(user, "costo_ia", 0) or 0)
    return {
        "id": user.id,
        "username": user.username,
        "nombre": _nombre(user),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": email,
        "email_duplicado": bool(email) and email.lower() in duplicados,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "es_interna": bool(perfil and perfil.es_interna),
        "exenta": exenta,
        "date_joined": _iso(user.date_joined),
        "last_login": _iso(user.last_login),
        "ultima_actividad": _iso(perfil.ultima_actividad) if perfil else None,
        "origen": perfil.origen if perfil else "desconocido",
        "utm_source": perfil.utm_source if perfil else "",
        "utm_medium": perfil.utm_medium if perfil else "",
        "utm_campaign": perfil.utm_campaign if perfil else "",
        "pacientes_count": int(getattr(user, "pacientes_count", 0) or 0),
        "sesiones_mes": int(getattr(user, "sesiones_mes", 0) or 0),
        "audio_minutos_total": round(audio_segundos / 60, 1),
        "tokens_ia_total": int(getattr(user, "tokens_total", 0) or 0),
        "costo_ia_total_usd": round(costo, 6),
        "suscripcion": {
            "estado": estado,
            "estado_visible": "exenta" if exenta else estado,
            "plan": suscripcion.plan if suscripcion else "estandar",
            "fin_prueba": _iso(suscripcion.fin_prueba) if suscripcion else None,
            "dias_restantes_prueba": None if exenta else _dias_prueba(suscripcion, ahora),
            "proximo_cobro": _iso(suscripcion.proximo_cobro) if suscripcion else None,
            "card_brand": (suscripcion.card_brand or "") if suscripcion else "",
            "card_last_four": (suscripcion.card_last_four or "") if suscripcion else "",
            "cancelada_en": _iso(suscripcion.cancelada_en) if suscripcion else None,
            "inactiva_desde": _iso(suscripcion.inactiva_desde) if suscripcion else None,
            "creada_en": _iso(suscripcion.creada_en) if suscripcion else None,
            "actualizada_en": _iso(suscripcion.actualizada_en) if suscripcion else None,
            "tiene_preapproval": bool(suscripcion and suscripcion.mp_preapproval_id),
            "monto_mensual_clp": PLANES.get(suscripcion.plan, PLANES["estandar"])[1]
            if suscripcion and suscripcion.estado == "activa" and not exenta
            else 0,
        },
    }


ORDENES = {
    "registro": "date_joined",
    "-registro": "-date_joined",
    "nombre": "first_name",
    "-nombre": "-first_name",
    "email": "email",
    "-email": "-email",
    "actividad": "perfil_psicologo__ultima_actividad",
    "-actividad": "-perfil_psicologo__ultima_actividad",
    "pacientes": "pacientes_count",
    "-pacientes": "-pacientes_count",
    "audio": "audio_segundos",
    "-audio": "-audio_segundos",
    "tokens": "tokens_total",
    "-tokens": "-tokens_total",
    "costo": "costo_ia",
    "-costo": "-costo_ia",
    "sesiones": "sesiones_mes",
    "-sesiones": "-sesiones_mes",
    "prueba": "suscripcion__fin_prueba",
    "-prueba": "-suscripcion__fin_prueba",
    "cobro": "suscripcion__proximo_cobro",
    "-cobro": "-suscripcion__proximo_cobro",
}


def queryset_usuarios(params):
    ahora = timezone.now()
    qs = User.objects.select_related("perfil_psicologo", "suscripcion")
    estado = (params.get("estado") or "").strip()
    plan = (params.get("plan") or "").strip()
    origen = (params.get("origen") or "").strip()
    q = (params.get("q") or "").strip()
    if estado in {"trial", "activa", "past_due", "cancelada", "expirada"}:
        qs = qs.filter(suscripcion__estado=estado)
    if plan in PLANES:
        qs = qs.filter(suscripcion__plan=plan)
    if params.get("inactivos") in {"1", "true", "si"}:
        limite = ahora - timedelta(days=14)
        qs = qs.filter(
            Q(perfil_psicologo__ultima_actividad__lt=limite)
            | Q(perfil_psicologo__ultima_actividad__isnull=True)
        )
    if params.get("prueba_por_vencer") in {"1", "true", "si"}:
        qs = qs.filter(
            is_superuser=False,
            suscripcion__estado="trial",
            suscripcion__fin_prueba__gt=ahora,
            suscripcion__fin_prueba__lte=ahora + timedelta(days=3),
        ).exclude(perfil_psicologo__es_interna=True)
    if origen:
        if origen == "desconocido":
            qs = qs.filter(Q(perfil_psicologo__utm_source="") | Q(perfil_psicologo__isnull=True))
        else:
            qs = qs.filter(perfil_psicologo__utm_source__iexact=origen)
    if q:
        qs = qs.filter(
            Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(username__icontains=q)
        )
    qs = _anotar_uso(qs, _inicio_mes())
    ordering = ORDENES.get(params.get("ordering") or "-registro", "-date_joined")
    return qs.order_by(ordering, "-id")


def listar_usuarios(params):
    qs = queryset_usuarios(params)
    try:
        page = max(1, int(params.get("page") or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = min(100, max(1, int(params.get("page_size") or PAGE_SIZE)))
    except (TypeError, ValueError):
        page_size = PAGE_SIZE
    total = qs.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)
    inicio = (page - 1) * page_size
    duplicados = _emails_duplicados()
    ahora = timezone.now()
    filas = [_fila_usuario(user, duplicados, ahora) for user in qs[inicio : inicio + page_size]]
    return {
        "count": total,
        "page": page,
        "pages": pages,
        "page_size": page_size,
        "results": filas,
    }


def exportar_usuarios_csv(params):
    duplicados = _emails_duplicados()
    ahora = timezone.now()
    buffer = StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "usuario",
            "nombre",
            "email",
            "email_duplicado",
            "registro",
            "ultima_actividad",
            "dias_prueba",
            "estado",
            "plan",
            "proximo_cobro",
            "tarjeta_marca",
            "tarjeta_ultimos4",
            "sesiones_mes",
            "pacientes",
            "audio_minutos",
            "tokens_ia",
            "costo_ia_usd",
            "origen",
            "es_interna",
            "es_superuser",
        ]
    )
    for user in queryset_usuarios(params).iterator(chunk_size=200):
        fila = _fila_usuario(user, duplicados, ahora)
        sub = fila["suscripcion"]
        writer.writerow(
            [
                fila["id"],
                fila["username"],
                fila["nombre"],
                fila["email"],
                "si" if fila["email_duplicado"] else "no",
                fila["date_joined"] or "",
                fila["ultima_actividad"] or "",
                "" if sub["dias_restantes_prueba"] is None else sub["dias_restantes_prueba"],
                sub["estado_visible"],
                sub["plan"],
                sub["proximo_cobro"] or "",
                sub["card_brand"],
                sub["card_last_four"],
                fila["sesiones_mes"],
                fila["pacientes_count"],
                f"{fila['audio_minutos_total']:.1f}",
                fila["tokens_ia_total"],
                f"{fila['costo_ia_total_usd']:.6f}",
                fila["origen"],
                "si" if fila["es_interna"] else "no",
                "si" if fila["is_superuser"] else "no",
            ]
        )
    return buffer.getvalue()


def _persona(user):
    return {
        "id": user.id,
        "email": user.email,
        "nombre": _nombre(user) or user.username,
    }


def _alertas(medibles, ahora):
    en_3_dias = ahora + timedelta(days=3)
    hace_3 = ahora - timedelta(days=3)
    hace_14 = ahora - timedelta(days=14)
    hace_24h = ahora - timedelta(hours=24)

    prueba_por_vencer = [
        {
            **_persona(user),
            "fin_prueba": _iso(user.suscripcion.fin_prueba),
            "dias": _dias_prueba(user.suscripcion, ahora),
        }
        for user in medibles.select_related("suscripcion").filter(
            suscripcion__estado="trial",
            suscripcion__fin_prueba__gt=ahora,
            suscripcion__fin_prueba__lte=en_3_dias,
        )[:20]
    ]
    sin_paciente = [
        _persona(user)
        for user in medibles.annotate(np=Count("pacientes")).filter(
            date_joined__lte=hace_3,
            suscripcion__estado="trial",
            np=0,
        )[:20]
    ]
    pagando_inactivos = [
        _persona(user)
        for user in medibles.select_related("perfil_psicologo").filter(suscripcion__estado="activa").filter(
            Q(perfil_psicologo__ultima_actividad__lt=hace_14)
            | Q(perfil_psicologo__ultima_actividad__isnull=True, last_login__lt=hace_14)
            | Q(perfil_psicologo__ultima_actividad__isnull=True, last_login__isnull=True)
        )[:20]
    ]
    pagos_fallidos = [
        {**_persona(user), "inactiva_desde": _iso(user.suscripcion.inactiva_desde)}
        for user in medibles.select_related("suscripcion").filter(suscripcion__estado="past_due")[:20]
    ]
    plus_pendiente = [
        {
            "id": item.id,
            "preapproval_id": item.mp_preapproval_id,
            "estado_mp": item.estado_mp,
            "creado_en": _iso(item.creado_en),
        }
        for item in PagoPlusPendiente.objects.filter(vinculado_a__isnull=True).order_by("-creado_en")[:20]
    ]
    fallos = (
        Sesion.objects.filter(estado=Sesion.Estado.ERROR, updated_at__gte=hace_24h)
        .values("paciente__psicologo_id", "paciente__psicologo__email", "paciente__psicologo__first_name", "paciente__psicologo__last_name")
        .annotate(cantidad=Count("id"))
        .order_by("-cantidad")[:20]
    )
    transcripciones = [
        {
            "id": item["paciente__psicologo_id"],
            "email": item["paciente__psicologo__email"] or "",
            "nombre": " ".join(
                part
                for part in (item["paciente__psicologo__first_name"], item["paciente__psicologo__last_name"])
                if part
            ).strip(),
            "cantidad": item["cantidad"],
        }
        for item in fallos
        if item["paciente__psicologo_id"]
    ]
    return {
        "prueba_por_vencer": prueba_por_vencer,
        "prueba_sin_paciente": sin_paciente,
        "pagando_sin_entrar": pagando_inactivos,
        "pago_fallido": pagos_fallidos,
        "plus_sin_vincular": plus_pendiente,
        "transcripciones_fallidas_24h": {
            "total": Sesion.objects.filter(estado=Sesion.Estado.ERROR, updated_at__gte=hace_24h).count(),
            "por_profesional": transcripciones,
        },
    }


def resumen():
    ahora = timezone.now()
    medibles = cuentas_medibles()
    hoy = _inicio_dia(ahora)
    hace_7 = ahora - timedelta(days=7)
    hace_30 = ahora - timedelta(days=30)
    inicio_mes = _inicio_mes(ahora)
    ids = medibles.values("id")

    pagados = (
        Suscripcion.objects.filter(user_id__in=ids, estado="activa")
        .values("plan")
        .annotate(c=Count("id"))
    )
    pagados_map = {item["plan"]: item["c"] for item in pagados}
    mrr = 0
    por_plan = {}
    for plan, (nombre, monto) in PLANES.items():
        cuentas = pagados_map.get(plan, 0)
        por_plan[plan] = {"nombre": nombre, "cuentas": cuentas, "mrr_clp": cuentas * monto}
        mrr += cuentas * monto

    semanas = _semanas(12)
    inicio = semanas[0]
    fin = semanas[-1] + timedelta(weeks=1)
    registros_map = {}
    for item in (
        medibles.filter(date_joined__gte=inicio, date_joined__lt=fin)
        .annotate(semana=TruncWeek("date_joined"))
        .values("semana")
        .annotate(c=Count("id"))
    ):
        if item["semana"]:
            registros_map[timezone.localtime(item["semana"]).date().isoformat()] = item["c"]

    from django.db.models import Min

    activaciones_map = {}
    primeros = (
        Paciente.objects.filter(psicologo_id__in=ids)
        .values("psicologo_id")
        .annotate(primero=Min("created_at"))
        .filter(primero__gte=inicio, primero__lt=fin)
    )
    for item in primeros:
        semana = _lunes_semana(item["primero"]).date().isoformat()
        activaciones_map[semana] = activaciones_map.get(semana, 0) + 1

    serie = []
    for semana in semanas:
        clave = semana.date().isoformat()
        serie.append(
            {
                "semana": clave,
                "registros": registros_map.get(clave, 0),
                "activaciones": activaciones_map.get(clave, 0),
            }
        )

    cancelaciones = Suscripcion.objects.filter(user_id__in=ids, estado="cancelada").filter(
        Q(cancelada_en__gte=inicio_mes) | Q(cancelada_en__isnull=True, inactiva_desde__gte=inicio_mes)
    ).count()

    return {
        "generado_en": _iso(ahora),
        "registros": {
            "hoy": medibles.filter(date_joined__gte=hoy).count(),
            "dias_7": medibles.filter(date_joined__gte=hace_7).count(),
            "dias_30": medibles.filter(date_joined__gte=hace_30).count(),
        },
        "activos": {
            "dias_7": medibles.filter(perfil_psicologo__ultima_actividad__gte=hace_7).count(),
            "dias_30": medibles.filter(perfil_psicologo__ultima_actividad__gte=hace_30).count(),
        },
        "en_prueba": medibles.filter(
            suscripcion__estado="trial",
            suscripcion__fin_prueba__gt=ahora,
        ).count(),
        "pagados_por_plan": por_plan,
        "mrr_clp": mrr,
        "cancelaciones_mes": cancelaciones,
        "pagos_fallidos": medibles.filter(suscripcion__estado="past_due").count(),
        "serie_semanal": serie,
        "alertas": _alertas(medibles, ahora),
        "por_origen": origen_resumen(medibles),
    }


def origen_resumen(medibles):
    filas = {}
    pagados = set(
        Suscripcion.objects.filter(user__in=medibles, estado="activa").values_list("user_id", flat=True)
    )
    for user in medibles.select_related("perfil_psicologo").only("id", "perfil_psicologo__utm_source"):
        origen = user.perfil_psicologo.origen if hasattr(user, "perfil_psicologo") else "desconocido"
        bucket = filas.setdefault(origen, {"origen": origen, "registros": 0, "pagos": 0})
        bucket["registros"] += 1
        if user.id in pagados:
            bucket["pagos"] += 1
    return sorted(filas.values(), key=lambda item: item["origen"])


def _conteo_mes(queryset, fecha_field, desde):
    from django.db.models.functions import TruncMonth

    data = {}
    for item in (
        queryset.filter(**{f"{fecha_field}__gte": desde})
        .annotate(mes=TruncMonth(fecha_field))
        .values("mes")
        .annotate(c=Count("id"))
    ):
        if item["mes"]:
            data[_mes_key(item["mes"])] = item["c"]
    return data


def _suma_mes(queryset, fecha_field, sum_field, desde):
    from django.db.models.functions import TruncMonth

    data = {}
    for item in (
        queryset.filter(**{f"{fecha_field}__gte": desde})
        .annotate(mes=TruncMonth(fecha_field))
        .values("mes")
        .annotate(s=Sum(sum_field))
    ):
        if item["mes"]:
            data[_mes_key(item["mes"])] = item["s"] or 0
    return data


def uso_por_mes(user_id):
    meses = _meses(6)
    desde = meses[0]
    claves = [_mes_key(mes) for mes in meses]
    vacio = {clave: 0 for clave in claves}

    def llenar(conteos):
        salida = dict(vacio)
        salida.update({k: conteos.get(k, 0) for k in claves})
        return salida

    sesiones = Sesion.objects.filter(paciente__psicologo_id=user_id)
    audio = _suma_mes(sesiones, "fecha_hora_inicio", "duracion_segundos", desde)
    ok = _conteo_mes(sesiones.filter(estado=Sesion.Estado.COMPLETADO), "fecha_hora_inicio", desde)
    error = _conteo_mes(sesiones.filter(estado=Sesion.Estado.ERROR), "fecha_hora_inicio", desde)
    pacientes = llenar(_conteo_mes(Paciente.objects.filter(psicologo_id=user_id), "created_at", desde))
    sesiones_n = llenar(_conteo_mes(sesiones, "fecha_hora_inicio", desde))
    minutos = {clave: round((audio.get(clave) or 0) / 60, 1) for clave in claves}
    mensajes = llenar(
        _conteo_mes(
            ChatMensaje.objects.filter(conversacion__paciente__psicologo_id=user_id, rol=ChatMensaje.Rol.USER),
            "created_at",
            desde,
        )
    )
    informes = llenar(_conteo_mes(InformeIA.objects.filter(paciente__psicologo_id=user_id), "created_at", desde))
    tests = llenar(_conteo_mes(EvaluacionAsignada.objects.filter(psicologo_id=user_id), "created_at", desde))
    agenda = llenar(_conteo_mes(AgendaCita.objects.filter(psicologo_id=user_id), "created_at", desde))
    boletas = llenar(
        _conteo_mes(
            EmisionBHE.objects.filter(
                cobro__psicologo_id=user_id,
                tipo=EmisionBHE.Tipo.EMISION,
                estado=EmisionBHE.Estado.EMITIDA,
            ),
            "created_at",
            desde,
        )
    )
    ok_map = llenar(ok)
    error_map = llenar(error)
    return [
        {
            "mes": clave,
            "pacientes": pacientes[clave],
            "sesiones": sesiones_n[clave],
            "minutos_audio": minutos[clave],
            "transcripciones_ok": ok_map[clave],
            "transcripciones_fallidas": error_map[clave],
            "mensajes_chat": mensajes[clave],
            "informes": informes[clave],
            "tests": tests[clave],
            "agenda": agenda[clave],
            "boletas": boletas[clave],
        }
        for clave in claves
    ]


def hitos(user_id):
    from django.db.models import Min

    primer_paciente = Paciente.objects.filter(psicologo_id=user_id).aggregate(f=Min("created_at"))["f"]
    primer_sesion = Sesion.objects.filter(paciente__psicologo_id=user_id).aggregate(f=Min("fecha_hora_inicio"))["f"]
    primer_tx = Sesion.objects.filter(
        paciente__psicologo_id=user_id,
        estado=Sesion.Estado.COMPLETADO,
    ).aggregate(f=Min("updated_at"))["f"]
    primer_boleta = EmisionBHE.objects.filter(
        cobro__psicologo_id=user_id,
        tipo=EmisionBHE.Tipo.EMISION,
        estado=EmisionBHE.Estado.EMITIDA,
    ).aggregate(f=Min("created_at"))["f"]
    return {
        "primer_paciente": _iso(primer_paciente),
        "primera_sesion": _iso(primer_sesion),
        "primera_transcripcion": _iso(primer_tx),
        "primera_boleta": _iso(primer_boleta),
    }


def costo_ia_usuario(user):
    filas = [
        {
            "servicio": item["servicio"],
            "modelo": item["modelo"],
            "tokens": item["tokens"] or 0,
            "costo_usd": round(float(item["costo"] or 0), 6),
            "registros": item["n"],
        }
        for item in RegistroConsumoIA.objects.filter(user=user)
        .values("servicio", "modelo")
        .annotate(tokens=Sum("tokens_total"), costo=Sum("costo_estimado_usd"), n=Count("id"))
        .order_by("-costo")
    ]
    total = round(sum(item["costo_usd"] for item in filas), 6)
    inicio = _inicio_mes()
    mes = RegistroConsumoIA.objects.filter(user=user, created_at__gte=inicio).aggregate(
        costo=Sum("costo_estimado_usd")
    )["costo"]
    suscripcion = getattr(user, "suscripcion", None)
    paga = 0
    if suscripcion and suscripcion.estado == "activa" and not cuenta_exenta_local(user):
        paga = PLANES.get(suscripcion.plan, PLANES["estandar"])[1]
    return {
        "por_servicio_modelo": filas,
        "total_usd": total,
        "mes_actual_usd": round(float(mes or 0), 6),
        "pago_mensual_clp": paga,
        "margen_nota": (
            "El costo de IA está en USD y la suscripción en CLP. "
            "No hay tipo de cambio guardado, así que no se convierten."
        ),
    }


def cuenta_exenta_local(user):
    perfil = getattr(user, "perfil_psicologo", None)
    return user.is_superuser or bool(perfil and perfil.es_interna)


def detalle_usuario(user):
    duplicados = _emails_duplicados()
    anotado = _anotar_uso(
        User.objects.select_related("perfil_psicologo", "suscripcion").filter(pk=user.pk),
        _inicio_mes(),
    ).get()
    fila = _fila_usuario(anotado, duplicados, timezone.now())
    suscripcion = anotado.suscripcion if hasattr(anotado, "suscripcion") else None
    plus = [
        {
            "preapproval_id": item.mp_preapproval_id,
            "estado_mp": item.estado_mp,
            "vinculado_en": _iso(item.vinculado_en),
            "creado_en": _iso(item.creado_en),
        }
        for item in PagoPlusPendiente.objects.filter(vinculado_a=user).order_by("-creado_en")[:20]
    ]
    return {
        "cuenta": fila,
        "historial_suscripcion": {
            "creada_en": _iso(suscripcion.creada_en) if suscripcion else None,
            "actualizada_en": _iso(suscripcion.actualizada_en) if suscripcion else None,
            "cancelada_en": _iso(suscripcion.cancelada_en) if suscripcion else None,
            "inactiva_desde": _iso(suscripcion.inactiva_desde) if suscripcion else None,
            "estado": suscripcion.estado if suscripcion else None,
            "plan": suscripcion.plan if suscripcion else None,
            "nota": "No hay un registro de cada cambio: se muestran las fechas que guarda la suscripción.",
        },
        "pagos_mercadopago": {
            "tiene_preapproval": bool(suscripcion and suscripcion.mp_preapproval_id),
            "tarjeta_marca": (suscripcion.card_brand or "") if suscripcion else "",
            "tarjeta_ultimos4": (suscripcion.card_last_four or "") if suscripcion else "",
            "proximo_cobro": _iso(suscripcion.proximo_cobro) if suscripcion else None,
            "plus_vinculados": plus,
            "nota": "El webhook no guarda cada cobro. Se muestra el estado vigente de la suscripción.",
        },
        "uso_por_mes": uso_por_mes(user.id),
        "costo_ia": costo_ia_usuario(anotado),
        "hitos": hitos(user.id),
    }


def ingresos():
    ahora = timezone.now()
    medibles = cuentas_medibles()
    ids = medibles.values("id")
    inicio_mes = _inicio_mes(ahora)
    en_7 = ahora + timedelta(days=7)
    pagados = Suscripcion.objects.filter(user_id__in=ids, estado="activa").select_related("user")
    por_plan = {plan: {"cuentas": 0, "mrr_clp": 0, "nombre": nombre} for plan, (nombre, _monto) in PLANES.items()}
    mrr = 0
    for suscripcion in pagados:
        monto = PLANES.get(suscripcion.plan, PLANES["estandar"])[1]
        por_plan.setdefault(suscripcion.plan, {"cuentas": 0, "mrr_clp": 0, "nombre": suscripcion.plan})
        por_plan[suscripcion.plan]["cuentas"] += 1
        por_plan[suscripcion.plan]["mrr_clp"] += monto
        mrr += monto

    meses = _meses(6)
    serie = []
    for mes in meses:
        siguiente = (mes + timedelta(days=32)).replace(day=1)
        altas = Suscripcion.objects.filter(
            user_id__in=ids,
            estado="activa",
            creada_en__gte=mes,
            creada_en__lt=siguiente,
        ).count()
        cancelaciones = Suscripcion.objects.filter(user_id__in=ids, estado="cancelada").filter(
            Q(cancelada_en__gte=mes, cancelada_en__lt=siguiente)
            | Q(cancelada_en__isnull=True, inactiva_desde__gte=mes, inactiva_desde__lt=siguiente)
        ).count()
        serie.append(
            {
                "mes": _mes_key(mes),
                "altas_aun_activas": altas,
                "cancelaciones": cancelaciones,
                "mrr_vigente_clp": mrr if mes == meses[-1] else None,
            }
        )

    proximos = []
    for suscripcion in pagados.filter(proximo_cobro__gte=ahora, proximo_cobro__lte=en_7).select_related("user"):
        proximos.append(
            {
                **_persona(suscripcion.user),
                "plan": suscripcion.plan,
                "monto_clp": PLANES.get(suscripcion.plan, PLANES["estandar"])[1],
                "proximo_cobro": _iso(suscripcion.proximo_cobro),
                "tarjeta_marca": suscripcion.card_brand or "",
                "tarjeta_ultimos4": suscripcion.card_last_four or "",
            }
        )
    fallidos = [
        {
            **_persona(suscripcion.user),
            "plan": suscripcion.plan,
            "inactiva_desde": _iso(suscripcion.inactiva_desde),
        }
        for suscripcion in Suscripcion.objects.filter(user_id__in=ids, estado="past_due").select_related("user")[:50]
    ]
    canceladas = [
        {
            **_persona(suscripcion.user),
            "plan": suscripcion.plan,
            "cancelada_en": _iso(suscripcion.cancelada_en or suscripcion.inactiva_desde),
        }
        for suscripcion in Suscripcion.objects.filter(user_id__in=ids, estado="cancelada")
        .filter(Q(cancelada_en__gte=inicio_mes) | Q(cancelada_en__isnull=True, inactiva_desde__gte=inicio_mes))
        .select_related("user")[:50]
    ]
    origen_pagos = {}
    for suscripcion in pagados.select_related("user__perfil_psicologo"):
        perfil = getattr(suscripcion.user, "perfil_psicologo", None)
        origen = perfil.origen if perfil else "desconocido"
        bucket = origen_pagos.setdefault(origen, {"origen": origen, "pagos": 0, "mrr_clp": 0})
        bucket["pagos"] += 1
        bucket["mrr_clp"] += PLANES.get(suscripcion.plan, PLANES["estandar"])[1]
    return {
        "mrr_clp": mrr,
        "mrr_por_plan": por_plan,
        "pagos_del_mes": {
            "cuentas": sum(item["cuentas"] for item in por_plan.values()),
            "monto_clp": mrr,
            "nota": "Mercado Pago no deja cada cobro en la app. El monto es el MRR vigente, no un extracto bancario.",
        },
        "serie_mensual": serie,
        "mrr_nota": "El MRR histórico no se puede reconstruir: solo el mes actual muestra el MRR vigente.",
        "proximos_cobros": proximos,
        "fallidos": fallidos,
        "cancelaciones": canceladas,
        "por_origen": sorted(origen_pagos.values(), key=lambda item: item["origen"]),
    }


def embudo():
    medibles = cuentas_medibles()
    semanas = _semanas(12)
    filas = []
    for semana in semanas:
        fin = semana + timedelta(weeks=1)
        cohorte = medibles.filter(date_joined__gte=semana, date_joined__lt=fin)
        registros = cohorte.count()
        con_paciente = cohorte.filter(pacientes__isnull=False).distinct().count()
        con_sesion = cohorte.filter(pacientes__sesiones__isnull=False).distinct().count()
        con_pago = cohorte.filter(suscripcion__estado="activa").distinct().count()

        def pct(parte):
            return round(100 * parte / registros, 1) if registros else 0

        filas.append(
            {
                "semana": semana.date().isoformat(),
                "registros": registros,
                "primer_paciente": con_paciente,
                "primera_sesion": con_sesion,
                "pago": con_pago,
                "pct_paciente": pct(con_paciente),
                "pct_sesion": pct(con_sesion),
                "pct_pago": pct(con_pago),
            }
        )
    origen = {}
    for user in medibles.select_related("perfil_psicologo", "suscripcion").only(
        "id",
        "perfil_psicologo__utm_source",
        "suscripcion__estado",
    ):
        clave = user.perfil_psicologo.origen if hasattr(user, "perfil_psicologo") else "desconocido"
        bucket = origen.setdefault(clave, {"origen": clave, "registros": 0, "pagos": 0})
        bucket["registros"] += 1
        suscripcion = getattr(user, "suscripcion", None)
        if suscripcion and suscripcion.estado == "activa":
            bucket["pagos"] += 1
    return {"cohortes": filas, "por_origen": sorted(origen.values(), key=lambda item: item["origen"])}


def uso_ia():
    desde = _meses(6)[0]
    ids = cuentas_medibles().values("id")
    from django.db.models.functions import TruncMonth

    por_servicio = []
    for item in (
        RegistroConsumoIA.objects.filter(user_id__in=ids, created_at__gte=desde)
        .annotate(mes=TruncMonth("created_at"))
        .values("mes", "servicio")
        .annotate(costo=Sum("costo_estimado_usd"), tokens=Sum("tokens_total"))
        .order_by("mes", "servicio")
    ):
        if not item["mes"]:
            continue
        por_servicio.append(
            {
                "mes": _mes_key(item["mes"]),
                "servicio": item["servicio"],
                "costo_usd": round(float(item["costo"] or 0), 6),
                "tokens": item["tokens"] or 0,
            }
        )
    top = []
    for item in (
        RegistroConsumoIA.objects.filter(user_id__in=ids)
        .values("user_id", "user__email", "user__first_name", "user__last_name")
        .annotate(costo=Sum("costo_estimado_usd"), tokens=Sum("tokens_total"))
        .order_by("-costo")[:10]
    ):
        top.append(
            {
                "id": item["user_id"],
                "email": item["user__email"],
                "nombre": " ".join(
                    part for part in (item["user__first_name"], item["user__last_name"]) if part
                ).strip(),
                "costo_usd": round(float(item["costo"] or 0), 6),
                "tokens": item["tokens"] or 0,
            }
        )
    return {"por_servicio_mes": por_servicio, "top_usuarios": top}


def marcar_interna(user, es_interna):
    perfil, _ = PerfilPsicologo.objects.get_or_create(
        user=user,
        defaults={"email_notificaciones": user.email or ""},
    )
    perfil.es_interna = bool(es_interna)
    perfil.save(update_fields=["es_interna", "updated_at"])
    return perfil.es_interna
