from datetime import timedelta
from io import BytesIO

from django.db import IntegrityError, transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from pacientes.models import Paciente

from . import cie10
from .escalas import ESCALAS, calcular_escala, catalogo_publico, get_escala
from .exportes import docx_documento, pdf_documento
from .ia import advertencias_informe, etiqueta_animo
from .models import (
    AplicacionEscala,
    DiagnosticoCIE10,
    DocumentoClinicoIA,
    PortalSeguimiento,
    RegistroAnimo,
    TareaIntersesion,
)
from .services import enlace_whatsapp, expiracion, generar_token, hash_token, notificar_psicologo, url_publica

DIAS_VIGENCIA_ESCALA = 7
DIAS_VIGENCIA_PORTAL = 90
TIPOS_INFORME = {t for t in DocumentoClinicoIA.Tipo.values if t != DocumentoClinicoIA.Tipo.BRIEF}
EMOCIONES = ["calma", "alegría", "ansiedad", "tristeza", "rabia", "cansancio", "miedo", "esperanza"]


def _paciente(request, paciente_id):
    return get_object_or_404(Paciente, pk=paciente_id, psicologo=request.user)


def _fecha(d):
    return d.isoformat() if d else None


# ---------------------------------------------------------------- Escalas

def serializar_aplicacion(a):
    esc = get_escala(a.escala) or {}
    return {
        "id": a.id, "escala": a.escala, "nombre": esc.get("nombre", a.escala), "canal": a.canal,
        "estado": a.estado, "vencida": a.vencida and a.estado == AplicacionEscala.Estado.PENDIENTE,
        "expira_en": _fecha(a.expira_en), "completada_en": _fecha(a.completada_en), "created_at": _fecha(a.created_at),
        "puntaje_total": a.puntaje_total, "severidad": a.severidad, "resultado": a.resultado,
        "respuestas": a.respuestas, "alerta_riesgo": a.alerta_riesgo, "alerta_revisada_en": _fecha(a.alerta_revisada_en),
    }


def _completar(aplicacion, respuestas):
    esc = get_escala(aplicacion.escala)
    norm, res = calcular_escala(esc, respuestas)
    era_alerta = aplicacion.alerta_riesgo
    aplicacion.respuestas = norm
    aplicacion.resultado = res
    aplicacion.puntaje_total = res["total"]
    aplicacion.severidad = res["severidad"]
    aplicacion.alerta_riesgo = any(a["validada"] for a in res["alertas_riesgo"]) or bool(res["alertas_riesgo"])
    aplicacion.estado = AplicacionEscala.Estado.COMPLETADA
    aplicacion.completada_en = aplicacion.completada_en or timezone.now()
    aplicacion.save()
    if aplicacion.alerta_riesgo and not era_alerta and aplicacion.canal != AplicacionEscala.Canal.EN_CONSULTA:
        notificar_psicologo(aplicacion.psicologo, aplicacion.paciente_id)
    return aplicacion


class CatalogoEscalasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([
            {k: e.get(k) for k in ("slug", "nombre", "nombre_largo", "dominio", "duracion_min", "mayor_es_mejor", "max",
                                   "min", "instrucciones", "opciones", "preguntas", "pregunta_funcional", "cortes",
                                   "subescalas", "referencia")}
            for e in ESCALAS.values()
        ])


class AplicacionesPacienteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        return Response([serializar_aplicacion(a) for a in p.aplicaciones_escala.all()[:100]])

    def post(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        slug = request.data.get("escala")
        canal = request.data.get("canal", AplicacionEscala.Canal.EN_CONSULTA)
        if slug not in ESCALAS:
            return Response({"detail": "Escala no válida."}, status=400)
        if canal not in AplicacionEscala.Canal.values:
            return Response({"detail": "Canal no válido."}, status=400)
        if canal == AplicacionEscala.Canal.EMAIL:
            return Response({"detail": "El envío por correo de escalas aún no está habilitado; usa el enlace."}, status=400)
        a = AplicacionEscala(paciente=p, psicologo=request.user, escala=slug, canal=canal)
        payload = {}
        if canal == AplicacionEscala.Canal.EN_CONSULTA:
            respuestas = request.data.get("respuestas")
            if respuestas is None:
                return Response({"detail": "Faltan las respuestas."}, status=400)
            try:
                with transaction.atomic():
                    a.save()
                    _completar(a, respuestas)
            except ValueError as e:
                return Response({"detail": str(e)}, status=400)
        else:
            token = generar_token()
            a.token_hash = hash_token(token)
            a.expira_en = expiracion(DIAS_VIGENCIA_ESCALA)
            a.save()
            url = url_publica(f"/escala/{token}")
            texto = (f"Hola {p.nombre}, te comparto un breve cuestionario de seguimiento de tu proceso. "
                     f"Es confidencial y toma pocos minutos: {url}")
            payload = {"enlace": url, "whatsapp_url": enlace_whatsapp(p.telefono_whatsapp, texto), "mensaje": texto}
        return Response({**serializar_aplicacion(a), **payload}, status=201)


class AplicacionDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        return get_object_or_404(AplicacionEscala, pk=pk, psicologo=request.user)

    def patch(self, request, pk):
        """Corregir respuestas de una aplicación en consulta (actualiza la misma aplicación)."""
        a = self._get(request, pk)
        if a.canal != AplicacionEscala.Canal.EN_CONSULTA:
            return Response({"detail": "Solo se pueden corregir aplicaciones hechas en consulta."}, status=400)
        try:
            _completar(a, request.data.get("respuestas"))
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(serializar_aplicacion(a))

    def delete(self, request, pk):
        a = self._get(request, pk)
        a.delete()
        return Response(status=204)


class CancelarAplicacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        a = get_object_or_404(AplicacionEscala, pk=pk, psicologo=request.user)
        if a.estado != AplicacionEscala.Estado.PENDIENTE:
            return Response({"detail": "Solo se pueden cancelar envíos pendientes."}, status=400)
        a.estado = AplicacionEscala.Estado.CANCELADA
        a.save(update_fields=["estado", "updated_at"])
        return Response(serializar_aplicacion(a))


class RevisarAlertaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        a = get_object_or_404(AplicacionEscala, pk=pk, psicologo=request.user)
        a.alerta_revisada_en = timezone.now()
        a.save(update_fields=["alerta_revisada_en", "updated_at"])
        return Response(serializar_aplicacion(a))


class AlertasPendientesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = AplicacionEscala.objects.filter(psicologo=request.user, alerta_riesgo=True, alerta_revisada_en__isnull=True)
        paciente = request.query_params.get("paciente")
        if paciente:
            qs = qs.filter(paciente_id=paciente)
        return Response([{**serializar_aplicacion(a), "paciente_id": a.paciente_id} for a in qs[:50]])


class TrayectoriaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        apps = p.aplicaciones_escala.filter(estado=AplicacionEscala.Estado.COMPLETADA).order_by("completada_en")
        salida = []
        for slug, esc in ESCALAS.items():
            puntos = [
                {"id": a.id, "fecha": _fecha(a.completada_en), "total": a.puntaje_total, "severidad": a.severidad,
                 "etiqueta": a.resultado.get("etiqueta", ""), "subescalas": a.resultado.get("subescalas", []),
                 "alerta_riesgo": a.alerta_riesgo}
                for a in apps if a.escala == slug
            ]
            if puntos:
                salida.append({"slug": slug, "nombre": esc["nombre"], "nombre_largo": esc["nombre_largo"], "max": esc["max"],
                               "min": esc.get("min", 0), "mayor_es_mejor": esc["mayor_es_mejor"], "cortes": esc.get("cortes"),
                               "subescalas": esc.get("subescalas"), "puntos": puntos})
        return Response({"escalas": salida})


def _app_por_token(token):
    return AplicacionEscala.objects.select_related("paciente", "psicologo").filter(token_hash=hash_token(token)).first()


def _estado_publico(a):
    if a is None:
        return "INVALIDO"
    if a.estado == AplicacionEscala.Estado.COMPLETADA:
        return "RESPONDIDA"
    if a.estado == AplicacionEscala.Estado.CANCELADA:
        return "CANCELADA"
    if a.vencida:
        return "VENCIDA"
    return "DISPONIBLE"


@method_decorator(ratelimit(key="ip", rate="30/m", method="GET", block=True), name="get")
@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True), name="post")
class EscalaPublicaView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        a = _app_por_token(token)
        estado = _estado_publico(a)
        if estado != "DISPONIBLE":
            return Response({"estado": estado}, status=404 if estado == "INVALIDO" else 410)
        prof = a.psicologo.get_full_name() or "tu profesional"
        return Response({"estado": estado, "paciente_nombre": a.paciente.nombre, "profesional": prof,
                         "cuestionario": catalogo_publico(get_escala(a.escala))})

    def post(self, request, token):
        a = _app_por_token(token)
        estado = _estado_publico(a)
        if estado != "DISPONIBLE":
            return Response({"estado": estado}, status=404 if estado == "INVALIDO" else 410)
        try:
            _completar(a, request.data.get("respuestas"))
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        # No se devuelve el puntaje al paciente: solo si mostrar recursos de ayuda.
        return Response({"estado": "RESPONDIDA", "riesgo": a.alerta_riesgo})


# ---------------------------------------------------------------- CIE-10

class Cie10BuscarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(cie10.buscar(request.query_params.get("q", "")))


class DiagnosticoPacienteView(APIView):
    permission_classes = [IsAuthenticated]

    def _ser(self, d):
        return {"codigo": d.codigo, "descripcion": d.descripcion, "presuntivo": d.presuntivo} if d else {"codigo": "", "descripcion": "", "presuntivo": True}

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        return Response(self._ser(DiagnosticoCIE10.objects.filter(paciente=p).first()))

    def put(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        codigo = (request.data.get("codigo") or "").strip().upper()
        descripcion = (request.data.get("descripcion") or "").strip() or (cie10.descripcion_de(codigo) or "")
        if codigo and not descripcion:
            return Response({"detail": "Indica la descripción del diagnóstico."}, status=400)
        d, _ = DiagnosticoCIE10.objects.update_or_create(
            paciente=p, defaults={"codigo": codigo[:10], "descripcion": descripcion[:255], "presuntivo": bool(request.data.get("presuntivo", True))}
        )
        return Response(self._ser(d))


# ---------------------------------------------------------------- Brief e informes

def serializar_documento(d):
    return {
        "id": d.id, "tipo": d.tipo, "tipo_label": d.get_tipo_display(), "estado": d.estado, "destinatario": d.destinatario,
        "contexto_adicional": d.contexto_adicional, "diagnostico_codigo": d.diagnostico_codigo,
        "diagnostico_descripcion": d.diagnostico_descripcion, "contenido": d.contenido, "advertencias": d.advertencias,
        "error": d.error, "modelo": d.modelo, "es_borrador": d.es_borrador, "finalizado_en": _fecha(d.finalizado_en),
        "created_at": _fecha(d.created_at), "updated_at": _fecha(d.updated_at),
    }


def _encolar(doc):
    from .tasks import generar_documento_clinico

    transaction.on_commit(lambda: generar_documento_clinico.delay(doc.id))


def _limite(request, paciente, tipos, maximo):
    hace_una_hora = timezone.now() - timedelta(hours=1)
    return DocumentoClinicoIA.objects.filter(psicologo=request.user, paciente=paciente, tipo__in=tipos, created_at__gte=hace_una_hora).count() >= maximo


class BriefView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        d = DocumentoClinicoIA.objects.filter(paciente=p, psicologo=request.user, tipo=DocumentoClinicoIA.Tipo.BRIEF).first()
        return Response(serializar_documento(d) if d else None)

    def post(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        if _limite(request, p, [DocumentoClinicoIA.Tipo.BRIEF], 5):
            return Response({"detail": "Demasiadas solicitudes seguidas. Espera un momento y reintenta."}, status=429)
        d = DocumentoClinicoIA.objects.create(paciente=p, psicologo=request.user, tipo=DocumentoClinicoIA.Tipo.BRIEF)
        _encolar(d)
        return Response(serializar_documento(d), status=202)


class InformesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        qs = DocumentoClinicoIA.objects.filter(paciente=p, psicologo=request.user, tipo__in=TIPOS_INFORME)
        return Response([serializar_documento(d) for d in qs[:50]])

    def post(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        tipo = request.data.get("tipo")
        if tipo not in TIPOS_INFORME:
            return Response({"detail": "Tipo de informe no válido."}, status=400)
        adv = advertencias_informe(p, tipo)
        diag = DiagnosticoCIE10.objects.filter(paciente=p).first()
        if tipo == DocumentoClinicoIA.Tipo.LICENCIA and not (diag and diag.codigo):
            return Response({"detail": "Para un informe de licencia médica primero registra el diagnóstico CIE-10 en la ficha.", "advertencias": adv}, status=400)
        if _limite(request, p, list(TIPOS_INFORME), 10):
            return Response({"detail": "Demasiadas solicitudes seguidas. Espera un momento y reintenta."}, status=429)
        d = DocumentoClinicoIA.objects.create(
            paciente=p, psicologo=request.user, tipo=tipo,
            destinatario=(request.data.get("destinatario") or "")[:255],
            contexto_adicional=(request.data.get("contexto_adicional") or "")[:4000],
            diagnostico_codigo=diag.codigo if diag else "", diagnostico_descripcion=diag.descripcion if diag else "",
            advertencias=adv,
        )
        _encolar(d)
        return Response(serializar_documento(d), status=202)


class DocumentoDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        return get_object_or_404(DocumentoClinicoIA, pk=pk, psicologo=request.user)

    def get(self, request, pk):
        return Response(serializar_documento(self._get(request, pk)))

    def patch(self, request, pk):
        d = self._get(request, pk)
        if "contenido" in request.data:
            d.contenido = request.data["contenido"] or ""
        if "destinatario" in request.data:
            d.destinatario = (request.data["destinatario"] or "")[:255]
        d.save()
        return Response(serializar_documento(d))

    def delete(self, request, pk):
        self._get(request, pk).delete()
        return Response(status=204)


class FinalizarDocumentoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        d = get_object_or_404(DocumentoClinicoIA, pk=pk, psicologo=request.user)
        if d.estado != DocumentoClinicoIA.Estado.LISTO:
            return Response({"detail": "El borrador aún no está listo."}, status=400)
        d.es_borrador = False
        d.finalizado_en = timezone.now()
        d.save()
        return Response(serializar_documento(d))


class RegenerarDocumentoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        d = get_object_or_404(DocumentoClinicoIA, pk=pk, psicologo=request.user)
        if not d.es_borrador:
            return Response({"detail": "Un informe marcado como final no se puede regenerar; edítalo manualmente."}, status=400)
        d.estado = DocumentoClinicoIA.Estado.PENDIENTE
        d.contenido = ""
        d.save()
        _encolar(d)
        return Response(serializar_documento(d), status=202)


class ExportarDocumentoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, formato):
        d = get_object_or_404(DocumentoClinicoIA, pk=pk, psicologo=request.user)
        try:
            from cuentas.acceso import registrar_acceso
            from cuentas.models import RegistroAcceso

            registrar_acceso(request, RegistroAcceso.Accion.EXPORTAR, d.paciente, f"Documento clínico IA #{d.id} ({formato})")
        except Exception:  # noqa: BLE001
            pass
        nombre = f"{d.get_tipo_display()}-{d.paciente.apellido or d.paciente_id}".replace(" ", "-").replace("/", "-").lower()
        if formato == "pdf":
            return FileResponse(BytesIO(pdf_documento(d)), as_attachment=True, filename=f"{nombre}.pdf")
        if formato == "docx":
            return FileResponse(BytesIO(docx_documento(d)), as_attachment=True, filename=f"{nombre}.docx")
        return Response({"detail": "Formato no válido."}, status=400)


# ---------------------------------------------------------------- Tareas y ánimo

def serializar_tarea(t):
    return {
        "id": t.id, "descripcion": t.descripcion, "fecha_entrega": _fecha(t.fecha_entrega), "sesion_id": t.sesion_id,
        "sesion_fecha": _fecha(t.sesion.fecha_hora_inicio) if t.sesion_id and t.sesion else None,
        "completada": t.completada, "completada_en": _fecha(t.completada_en), "completada_por": t.completada_por,
        "nota_paciente": t.nota_paciente, "visible_para_paciente": t.visible_para_paciente,
        "vencida": bool(not t.completada and t.fecha_entrega and t.fecha_entrega < timezone.localdate()),
        "created_at": _fecha(t.created_at),
    }


def serializar_animo(a):
    return {"id": a.id, "fecha": _fecha(a.fecha), "valor": a.valor, "etiqueta": etiqueta_animo(a.valor),
            "emociones": a.emociones, "nota": a.nota, "registrado_por": a.registrado_por}


def _validar_animo(data):
    try:
        valor = int(data.get("valor"))
    except (TypeError, ValueError):
        raise ValueError("El ánimo debe ser un número del 1 al 10.")
    if not 1 <= valor <= 10:
        raise ValueError("El ánimo debe ser un número del 1 al 10.")
    emociones = [e for e in (data.get("emociones") or []) if e in EMOCIONES][:5]
    return valor, emociones, (data.get("nota") or "")[:500]


def _guardar_animo(paciente, origen, data, fecha=None):
    valor, emociones, nota = _validar_animo(data)
    a, _ = RegistroAnimo.objects.update_or_create(
        paciente=paciente, fecha=fecha or timezone.localdate(), registrado_por=origen,
        defaults={"valor": valor, "emociones": emociones, "nota": nota},
    )
    return a


def _completar_tarea(t, por, nota):
    t.completada = True
    t.completada_en = timezone.now()
    t.completada_por = por
    if nota is not None:
        t.nota_paciente = (nota or "")[:1000]
    t.save()


class TareasPacienteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        return Response([serializar_tarea(t) for t in p.tareas_intersesion.select_related("sesion")])

    def post(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        desc = (request.data.get("descripcion") or "").strip()
        if not desc:
            return Response({"detail": "Escribe la descripción de la tarea."}, status=400)
        sesion_id = request.data.get("sesion_id")
        sesion = p.sesiones.filter(pk=sesion_id).first() if sesion_id else p.sesiones.order_by("-fecha_hora_inicio").first()
        t = TareaIntersesion.objects.create(
            paciente=p, psicologo=request.user, sesion=sesion, descripcion=desc[:1000],
            fecha_entrega=request.data.get("fecha_entrega") or None,
            visible_para_paciente=bool(request.data.get("visible_para_paciente", True)),
        )
        t.refresh_from_db()
        return Response(serializar_tarea(t), status=201)


class TareaDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        t = get_object_or_404(TareaIntersesion, pk=pk, psicologo=request.user)
        for campo in ("descripcion", "fecha_entrega", "visible_para_paciente"):
            if campo in request.data:
                setattr(t, campo, request.data[campo] or (None if campo == "fecha_entrega" else request.data[campo]))
        if request.data.get("completada") is False:
            t.completada, t.completada_en, t.completada_por = False, None, ""
        t.save()
        t.refresh_from_db()
        return Response(serializar_tarea(t))

    def delete(self, request, pk):
        get_object_or_404(TareaIntersesion, pk=pk, psicologo=request.user).delete()
        return Response(status=204)


class CompletarTareaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        t = get_object_or_404(TareaIntersesion, pk=pk, psicologo=request.user)
        _completar_tarea(t, TareaIntersesion.CompletadaPor.PSICOLOGO, request.data.get("nota"))
        return Response(serializar_tarea(t))


class AnimoPacienteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        dias = int(request.query_params.get("dias", 90) or 90)
        qs = p.registros_animo.filter(fecha__gte=timezone.localdate() - timedelta(days=min(dias, 365)))
        return Response([serializar_animo(a) for a in qs])

    def post(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        try:
            a = _guardar_animo(p, RegistroAnimo.Origen.PSICOLOGO, request.data, request.data.get("fecha") or None)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(serializar_animo(a), status=201)


class AnimoDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        get_object_or_404(RegistroAnimo, pk=pk, paciente__psicologo=request.user).delete()
        return Response(status=204)


class PortalPacienteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        portal = PortalSeguimiento.objects.filter(paciente=p).first()
        return Response({"activo": bool(portal and portal.vigente), "expira_en": _fecha(portal.expira_en) if portal else None,
                         "ultimo_acceso": _fecha(portal.ultimo_acceso) if portal else None})

    def post(self, request, paciente_id):
        """Genera o renueva el enlace. No envía nada: devuelve la URL y un enlace wa.me opcional."""
        p = _paciente(request, paciente_id)
        token = generar_token()
        PortalSeguimiento.objects.update_or_create(
            paciente=p, defaults={"token_hash": hash_token(token), "activo": True, "expira_en": expiracion(DIAS_VIGENCIA_PORTAL)}
        )
        url = url_publica(f"/seguimiento/{token}")
        texto = f"Hola {p.nombre}, este es tu espacio para registrar cómo te sientes y marcar tus tareas entre sesiones: {url}"
        return Response({"activo": True, "enlace": url, "whatsapp_url": enlace_whatsapp(p.telefono_whatsapp, texto), "mensaje": texto}, status=201)

    def delete(self, request, paciente_id):
        p = _paciente(request, paciente_id)
        PortalSeguimiento.objects.filter(paciente=p).update(activo=False)
        return Response(status=204)


def _portal(token):
    portal = PortalSeguimiento.objects.select_related("paciente", "paciente__psicologo").filter(token_hash=hash_token(token)).first()
    if not portal:
        return None, Response({"estado": "INVALIDO"}, status=404)
    if not portal.vigente:
        return None, Response({"estado": "VENCIDO"}, status=410)
    return portal, None


def _alerta_animo_bajo(paciente):
    ultimos = list(paciente.registros_animo.filter(registrado_por=RegistroAnimo.Origen.PACIENTE).order_by("-fecha")[:2])
    if len(ultimos) == 2 and all(a.valor <= 2 for a in ultimos) and (ultimos[0].fecha - ultimos[1].fecha).days == 1:
        notificar_psicologo(paciente.psicologo, paciente.id)


@method_decorator(ratelimit(key="ip", rate="30/m", method="GET", block=True), name="get")
class PortalPublicoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        portal, error = _portal(token)
        if error:
            return error
        portal.ultimo_acceso = timezone.now()
        portal.save(update_fields=["ultimo_acceso"])
        p = portal.paciente
        tareas = p.tareas_intersesion.filter(visible_para_paciente=True).filter(
            completada=False) | p.tareas_intersesion.filter(visible_para_paciente=True, completada=True,
                                                            completada_en__gte=timezone.now() - timedelta(days=14))
        animo = p.registros_animo.filter(registrado_por=RegistroAnimo.Origen.PACIENTE, fecha__gte=timezone.localdate() - timedelta(days=14))
        return Response({
            "paciente_nombre": p.nombre, "profesional": p.psicologo.get_full_name() or "tu profesional",
            "tareas": [{k: v for k, v in serializar_tarea(t).items() if k in ("id", "descripcion", "fecha_entrega", "completada", "nota_paciente", "vencida")}
                       for t in tareas.distinct().order_by("completada", "fecha_entrega")],
            "animo": [serializar_animo(a) for a in animo], "emociones_disponibles": EMOCIONES,
        })


@method_decorator(ratelimit(key="ip", rate="20/m", method="POST", block=True), name="post")
class PortalCompletarTareaView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token, tarea_id):
        portal, error = _portal(token)
        if error:
            return error
        t = get_object_or_404(TareaIntersesion, pk=tarea_id, paciente=portal.paciente, visible_para_paciente=True)
        _completar_tarea(t, TareaIntersesion.CompletadaPor.PACIENTE, request.data.get("nota"))
        return Response({"ok": True})


@method_decorator(ratelimit(key="ip", rate="20/m", method="POST", block=True), name="post")
class PortalAnimoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        portal, error = _portal(token)
        if error:
            return error
        try:
            a = _guardar_animo(portal.paciente, RegistroAnimo.Origen.PACIENTE, request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        _alerta_animo_bajo(portal.paciente)
        return Response({"ok": True, "valor": a.valor, "mostrar_ayuda": a.valor <= 2})
