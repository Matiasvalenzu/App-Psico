import json
import logging
import mercadopago
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import PLANES, PagoPlusPendiente, Suscripcion

logger = logging.getLogger(__name__)


def _get_mp_sdk():
    token = getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "") or ""
    if not token:
        logger.warning("MERCADOPAGO_ACCESS_TOKEN is not configured.")
    return mercadopago.SDK(token)


def _plan_solicitado(request):
    """Plan pedido en el body; Plus solo se contrata cuando PLAN_PLUS_DISPONIBLE está activo."""
    plan = request.data.get("plan") or "estandar"
    if plan not in PLANES or (plan == "plus" and not settings.PLAN_PLUS_DISPONIBLE):
        return None
    return plan


def _asignar_plan(suscripcion, plan):
    """Un piloto Plus asignado por Admin conserva Plus al contratar Estándar mientras el flag está apagado."""
    if not (plan == "estandar" and suscripcion.plan == "plus" and not settings.PLAN_PLUS_DISPONIBLE):
        suscripcion.plan = plan


def _plan_mp_id(plan):
    if plan == "plus":
        return getattr(settings, "MERCADOPAGO_PLUS_PLAN_ID", "") or ""
    return getattr(settings, "MERCADOPAGO_PLAN_ID", "") or ""


def _cancelar_preapproval_anterior(sdk, suscripcion, nuevo_id):
    """Si ya pagaba otra suscripción, se cancela para no cobrar las dos."""
    anterior = suscripcion.mp_preapproval_id
    if not anterior or anterior == nuevo_id or suscripcion.estado != "activa":
        return
    try:
        sdk.preapproval().update(anterior, {"status": "cancelled"})
    except Exception as e:
        logger.warning(f"No se pudo cancelar el preapproval anterior de user={suscripcion.user_id}: {e}")


class SuscripcionEstadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        suscripcion, _ = Suscripcion.objects.get_or_create(
            user=request.user,
            defaults={
                "estado": "trial",
                "fin_prueba": timezone.now() + timedelta(days=14),
            },
        )

        # Update trial status if expired
        suscripcion.expirar_si_vencida()

        dias_restantes = None
        if suscripcion.fin_prueba and suscripcion.estado == "trial":
            delta = suscripcion.fin_prueba - timezone.now()
            dias_restantes = max(0, delta.days + (1 if delta.seconds > 0 else 0))

        public_key = getattr(settings, "MERCADOPAGO_PUBLIC_KEY", "") or ""

        return Response(
            {
                "estado": suscripcion.estado,
                "plan": suscripcion.plan,
                "boletas_habilitadas": suscripcion.tiene_boletas,
                "plan_plus_disponible": settings.PLAN_PLUS_DISPONIBLE,
                "plus_url": settings.MERCADOPAGO_PLUS_URL,
                "planes": {clave: {"nombre": nombre, "monto": monto} for clave, (nombre, monto) in PLANES.items()},
                "fin_prueba": suscripcion.fin_prueba,
                "dias_restantes_prueba": dias_restantes,
                "is_active_or_trial": suscripcion.is_active_or_trial,
                "mp_preapproval_id": suscripcion.mp_preapproval_id,
                "card_brand": suscripcion.card_brand,
                "card_last_four": suscripcion.card_last_four,
                "proximo_cobro": suscripcion.proximo_cobro,
                "cancelada_en": suscripcion.cancelada_en,
                "public_key": public_key,
            }
        )


class ContratarCardView(APIView):
    """
    Recibe el card_token generado de forma segura en el frontend con MercadoPago.js
    y crea una suscripción recurrente mediante la API /preapproval de Mercado Pago.
    Si el usuario está dentro del período de prueba de 14 días, el cobro se difiere
    automáticamente a la fecha de término del trial.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        payment_method_id = request.data.get("payment_method_id", "")
        card_last_four = request.data.get("card_last_four", "")
        payer_email = request.data.get("payer_email") or request.user.email

        if not token:
            return Response(
                {"error": "El token de tarjeta es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plan = _plan_solicitado(request)
        if plan is None:
            return Response({"error": "Plan no disponible."}, status=status.HTTP_400_BAD_REQUEST)
        nombre_plan, monto_plan = PLANES[plan]

        suscripcion, _ = Suscripcion.objects.get_or_create(
            user=request.user,
            defaults={
                "estado": "trial",
                "fin_prueba": timezone.now() + timedelta(days=14),
            },
        )

        # Determinar fecha de inicio del cobro:
        # Si está en trial vigente, diferir al fin del trial (Estándar y Plus). Si no, cobrar de inmediato.
        ahora = timezone.now()
        is_trial_vigente = (
            suscripcion.estado == "trial"
            and suscripcion.fin_prueba
            and suscripcion.fin_prueba > ahora
        )

        if is_trial_vigente:
            # ISO 8601 con zona horaria UTC para Mercado Pago
            # Mercado Pago requiere formato YYYY-MM-DDTHH:MM:SS.000Z
            start_date_dt = suscripcion.fin_prueba
            start_date_str = start_date_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            proximo_cobro_dt = start_date_dt
        else:
            # Inicio inmediato: Mercado Pago permite diferir 1 minuto o no enviar start_date
            start_date_dt = ahora + timedelta(minutes=2)
            start_date_str = start_date_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            proximo_cobro_dt = ahora + timedelta(days=30)

        sdk = _get_mp_sdk()

        preapproval_data = {
            "reason": nombre_plan,
            "external_reference": str(request.user.id),
            "payer_email": payer_email,
            "card_token_id": token,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": monto_plan,
                "currency_id": "CLP",
                "start_date": start_date_str,
            },
            "back_url": f"{settings.PUBLIC_APP_URL}/dashboard/suscripcion",
            "status": "authorized",
        }

        plan_id = _plan_mp_id(plan)
        if plan_id:
            preapproval_data["preapproval_plan_id"] = plan_id

        try:
            logger.info(
                f"Creando preapproval para user={request.user.id} con start_date={start_date_str}"
            )
            mp_response = sdk.preapproval().create(preapproval_data)
        except Exception as e:
            logger.error(f"Excepción al conectar con Mercado Pago: {str(e)}")
            return Response(
                {"error": "No fue posible comunicarse con Mercado Pago. Intente nuevamente."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        resp_status = mp_response.get("status")
        resp_data = mp_response.get("response", {})

        if resp_status in (200, 201):
            preapproval_id = resp_data.get("id")
            _cancelar_preapproval_anterior(sdk, suscripcion, preapproval_id)
            suscripcion.estado = "activa"
            _asignar_plan(suscripcion, plan)
            suscripcion.mp_preapproval_id = preapproval_id
            suscripcion.mp_payer_id = str(resp_data.get("payer_id", ""))
            suscripcion.card_brand = payment_method_id
            suscripcion.card_last_four = card_last_four
            suscripcion.proximo_cobro = proximo_cobro_dt
            suscripcion.cancelada_en = None
            suscripcion.save()

            return Response(
                {
                    "status": "ok",
                    "message": "Suscripción activada con éxito",
                    "preapproval_id": preapproval_id,
                    "proximo_cobro": suscripcion.proximo_cobro,
                    "card_brand": suscripcion.card_brand,
                    "card_last_four": suscripcion.card_last_four,
                },
                status=status.HTTP_200_OK,
            )
        else:
            error_msg = resp_data.get("message") or resp_data.get("error") or "Error al procesar la tarjeta."
            logger.error(f"Error Mercado Pago API ({resp_status}): {resp_data}")
            return Response(
                {"error": error_msg, "details": resp_data},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CancelarSuscripcionView(APIView):
    """
    Cancela la suscripción recurrente en Mercado Pago y actualiza el estado local.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            suscripcion = request.user.suscripcion
        except Suscripcion.DoesNotExist:
            return Response(
                {"error": "No existe una suscripción para este usuario."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not suscripcion.mp_preapproval_id:
            suscripcion.estado = "cancelada"
            suscripcion.cancelada_en = timezone.now()
            suscripcion.save()
            return Response({"status": "ok", "message": "Suscripción cancelada"})

        sdk = _get_mp_sdk()
        try:
            # Enviar actualización a Mercado Pago para cancelar el cobro automático
            update_data = {"status": "cancelled"}
            mp_resp = sdk.preapproval().update(suscripcion.mp_preapproval_id, update_data)
            logger.info(f"Cancelación en Mercado Pago preapproval {suscripcion.mp_preapproval_id}: {mp_resp.get('status')}")
        except Exception as e:
            logger.warning(f"Error comunicando cancelación a Mercado Pago: {e}")

        suscripcion.estado = "cancelada"
        suscripcion.cancelada_en = timezone.now()
        suscripcion.save()

        return Response(
            {
                "status": "ok",
                "message": "Tu suscripción ha sido cancelada. No se realizarán nuevos cobros.",
            }
        )


class CambiarPlanView(APIView):
    """
    Cambia el monto del preapproval vigente en Mercado Pago (Estándar <-> Plus) sin pedir la tarjeta de nuevo.
    Sin suscripción pagada activa, el frontend debe contratar con el plan elegido.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = _plan_solicitado(request)
        if plan is None:
            return Response({"error": "Plan no disponible."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            suscripcion = request.user.suscripcion
        except Suscripcion.DoesNotExist:
            suscripcion = None
        if not suscripcion or suscripcion.estado != "activa" or not suscripcion.mp_preapproval_id:
            return Response(
                {"error": "Primero activa tu suscripción con una tarjeta.", "code": "sin_suscripcion"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if suscripcion.plan == plan:
            return Response({"status": "ok", "plan": plan})

        nombre_plan, monto_plan = PLANES[plan]
        try:
            mp_resp = _get_mp_sdk().preapproval().update(
                suscripcion.mp_preapproval_id,
                {"reason": nombre_plan, "auto_recurring": {"transaction_amount": monto_plan, "currency_id": "CLP"}},
            )
        except Exception as e:
            logger.error(f"Excepción al cambiar plan en Mercado Pago: {e}")
            mp_resp = {}
        if mp_resp.get("status") != 200:
            logger.error(f"Error Mercado Pago API al cambiar plan ({mp_resp.get('status')}): {mp_resp.get('response')}")
            return Response(
                {"error": "No fue posible cambiar el plan en Mercado Pago. Intente nuevamente."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        suscripcion.plan = plan
        suscripcion.save(update_fields=["plan"])
        return Response({"status": "ok", "plan": plan})


class VincularPreapprovalView(APIView):
    """
    El enlace público de Plus crea la suscripción en Mercado Pago sin decir quién pagó (sin external_reference
    ni correo). Al volver, MP agrega ?preapproval_id= a la back_url y el frontend lo envía aquí: se confirma
    con MP que es del plan Plus y se asigna al usuario que lo reclama primero.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        preapproval_id = str(request.data.get("preapproval_id") or "").strip()
        plan_id = settings.MERCADOPAGO_PLUS_PLAN_ID
        if not preapproval_id.isalnum() or not plan_id:
            return Response({"error": "Suscripción no válida."}, status=status.HTTP_400_BAD_REQUEST)
        if Suscripcion.objects.filter(mp_preapproval_id=preapproval_id).exclude(user=request.user).exists():
            return Response({"error": "Esta suscripción ya está asociada a otra cuenta."}, status=status.HTTP_409_CONFLICT)

        sdk = _get_mp_sdk()
        try:
            mp_resp = sdk.preapproval().get(preapproval_id)
        except Exception as e:
            logger.error(f"Excepción al consultar preapproval en Mercado Pago: {e}")
            mp_resp = {}
        if mp_resp.get("status") != 200:
            return Response(
                {"error": "No fue posible confirmar la suscripción con Mercado Pago. Intenta nuevamente."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        data = mp_resp.get("response", {})
        if data.get("preapproval_plan_id") != plan_id or data.get("status") not in ("authorized", "pending"):
            return Response({"error": "La suscripción no corresponde al Plan Plus."}, status=status.HTTP_400_BAD_REQUEST)
        referencia = data.get("external_reference")
        if referencia and referencia != str(request.user.id):
            return Response({"error": "Esta suscripción ya está asociada a otra cuenta."}, status=status.HTTP_409_CONFLICT)

        suscripcion, _ = Suscripcion.objects.get_or_create(
            user=request.user,
            defaults={"estado": "trial", "fin_prueba": timezone.now() + timedelta(days=14)},
        )
        _cancelar_preapproval_anterior(sdk, suscripcion, preapproval_id)

        if data.get("status") == "authorized":
            suscripcion.estado = "activa"
            suscripcion.cancelada_en = None
        suscripcion.plan = "plus"
        suscripcion.mp_preapproval_id = preapproval_id
        suscripcion.mp_payer_id = str(data.get("payer_id") or "")
        suscripcion.card_brand = (data.get("payment_method_id") or "")[:20] or None
        suscripcion.card_last_four = None
        suscripcion.proximo_cobro = parse_datetime(data.get("next_payment_date") or "") or suscripcion.proximo_cobro
        suscripcion.save()
        PagoPlusPendiente.objects.filter(mp_preapproval_id=preapproval_id, vinculado_a__isnull=True).update(
            vinculado_a=request.user, vinculado_en=timezone.now()
        )
        logger.info(f"Preapproval Plus vinculado a user={request.user.id} ({data.get('status')})")
        return Response({"status": "ok", "plan": "plus", "estado": suscripcion.estado})


class CheckoutView(APIView):
    """
    Genera un checkout hospedado en Mercado Pago retornando init_point
    (utilizado como fallback o enlace directo).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        sdk = _get_mp_sdk()

        try:
            suscripcion = request.user.suscripcion
        except Suscripcion.DoesNotExist:
            return Response(
                {"error": "No subscription object found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = _plan_solicitado(request)
        if plan is None:
            return Response({"error": "Plan no disponible."}, status=status.HTTP_400_BAD_REQUEST)
        nombre_plan, monto_plan = PLANES[plan]

        preapproval_data = {
            "reason": nombre_plan,
            "external_reference": str(request.user.id),
            "payer_email": request.user.email,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": monto_plan,
                "currency_id": "CLP",
            },
            "back_url": f"{settings.PUBLIC_APP_URL}/dashboard/suscripcion",
            "status": "pending",
        }

        # Si aún está en trial, diferir primer cobro (Estándar y Plus)
        ahora = timezone.now()
        if suscripcion.estado == "trial" and suscripcion.fin_prueba and suscripcion.fin_prueba > ahora:
            preapproval_data["auto_recurring"]["start_date"] = suscripcion.fin_prueba.strftime(
                "%Y-%m-%dT%H:%M:%S.000Z"
            )
            suscripcion.proximo_cobro = suscripcion.fin_prueba

        preapproval_response = sdk.preapproval().create(preapproval_data)

        if preapproval_response.get("status") == 201:
            init_point = preapproval_response["response"]["init_point"]
            suscripcion.mp_preapproval_id = preapproval_response["response"]["id"]
            _asignar_plan(suscripcion, plan)
            suscripcion.save()
            return Response({"init_point": init_point})
        else:
            return Response(
                preapproval_response.get("response", {}),
                status=status.HTTP_400_BAD_REQUEST,
            )


class WebhookView(APIView):
    """
    Webhook público para notificaciones instantáneas de Mercado Pago.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        action = request.data.get("action")
        type_str = request.data.get("type")

        if type_str == "subscription_preapproval":
            sdk = _get_mp_sdk()
            mp_id = request.data.get("data", {}).get("id")
            if mp_id:
                try:
                    preapproval_response = sdk.preapproval().get(mp_id)
                    if preapproval_response.get("status") == 200:
                        data = preapproval_response.get("response", {})
                        user_id = data.get("external_reference")
                        mp_status = data.get("status")

                        # Las suscripciones del enlace de Plus no traen external_reference: se reconocen
                        # por el preapproval que /vincular/ ya dejó guardado.
                        if user_id:
                            suscripcion = Suscripcion.objects.filter(user__id=user_id).first()
                        else:
                            suscripcion = Suscripcion.objects.filter(mp_preapproval_id=mp_id).first()
                        # Un aviso de un preapproval reemplazado (p. ej. el Estándar cancelado al pasar a Plus)
                        # no debe tocar la suscripción vigente.
                        if suscripcion and suscripcion.mp_preapproval_id in (None, "", mp_id):
                            if mp_status == "authorized":
                                suscripcion.estado = "activa"
                            elif mp_status == "paused":
                                suscripcion.estado = "past_due"
                            elif mp_status == "cancelled":
                                suscripcion.estado = "cancelada"
                            plan_plus = settings.MERCADOPAGO_PLUS_PLAN_ID
                            if plan_plus and data.get("preapproval_plan_id") == plan_plus:
                                suscripcion.plan = "plus"

                            suscripcion.mp_preapproval_id = mp_id
                            suscripcion.save()
                        elif not suscripcion and settings.MERCADOPAGO_PLUS_PLAN_ID and data.get("preapproval_plan_id") == settings.MERCADOPAGO_PLUS_PLAN_ID:
                            # Pagó con el enlace de Plus y no volvió a /suscripcionok: queda pendiente de revisión.
                            pendiente, creado = PagoPlusPendiente.objects.update_or_create(
                                mp_preapproval_id=mp_id, defaults={"estado_mp": mp_status or ""}
                            )
                            if creado:
                                from .tasks import avisar_pago_plus_sin_vincular

                                avisar_pago_plus_sin_vincular.apply_async(args=[pendiente.pk], countdown=1800)
                except Exception as e:
                    logger.error(f"Error procesando webhook Mercado Pago: {e}")

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
