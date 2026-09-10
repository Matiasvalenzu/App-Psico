import json
import logging
import mercadopago
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import Suscripcion

logger = logging.getLogger(__name__)


def _get_mp_sdk():
    token = getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "") or ""
    if not token:
        logger.warning("MERCADOPAGO_ACCESS_TOKEN is not configured.")
    return mercadopago.SDK(token)


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
        if suscripcion.estado == "trial" and suscripcion.fin_prueba:
            if timezone.now() > suscripcion.fin_prueba:
                suscripcion.estado = "expirada"
                suscripcion.save(update_fields=["estado", "actualizada_en"])

        dias_restantes = None
        if suscripcion.fin_prueba and suscripcion.estado == "trial":
            delta = suscripcion.fin_prueba - timezone.now()
            dias_restantes = max(0, delta.days + (1 if delta.seconds > 0 else 0))

        public_key = getattr(settings, "MERCADOPAGO_PUBLIC_KEY", "") or ""

        return Response(
            {
                "estado": suscripcion.estado,
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

        suscripcion, _ = Suscripcion.objects.get_or_create(
            user=request.user,
            defaults={
                "estado": "trial",
                "fin_prueba": timezone.now() + timedelta(days=14),
            },
        )

        # Determinar fecha de inicio del cobro:
        # Si está en trial vigente, diferir al fin del trial. Si no, cobrar de inmediato.
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
            "reason": "Plan Estándar - Psiconex",
            "external_reference": str(request.user.id),
            "payer_email": payer_email,
            "card_token_id": token,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": 4990,
                "currency_id": "CLP",
                "start_date": start_date_str,
            },
            "back_url": f"{settings.PUBLIC_APP_URL}/dashboard/suscripcion",
            "status": "authorized",
        }

        # Si existe un plan_id configurado, vincularlo opcionalmente
        plan_id = getattr(settings, "MERCADOPAGO_PLAN_ID", "")
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
            suscripcion.estado = "activa"
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

        preapproval_data = {
            "reason": "Plan Estándar - Psiconex",
            "external_reference": str(request.user.id),
            "payer_email": request.user.email,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": 4990,
                "currency_id": "CLP",
            },
            "back_url": f"{settings.PUBLIC_APP_URL}/dashboard/suscripcion",
            "status": "pending",
        }

        # Si aún está en trial, diferir primer cobro
        ahora = timezone.now()
        if suscripcion.estado == "trial" and suscripcion.fin_prueba and suscripcion.fin_prueba > ahora:
            preapproval_data["auto_recurring"]["start_date"] = suscripcion.fin_prueba.strftime(
                "%Y-%m-%dT%H:%M:%S.000Z"
            )

        preapproval_response = sdk.preapproval().create(preapproval_data)

        if preapproval_response.get("status") == 201:
            init_point = preapproval_response["response"]["init_point"]
            suscripcion.mp_preapproval_id = preapproval_response["response"]["id"]
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

                        if user_id:
                            try:
                                suscripcion = Suscripcion.objects.get(user__id=user_id)
                                if mp_status == "authorized":
                                    suscripcion.estado = "activa"
                                elif mp_status == "paused":
                                    suscripcion.estado = "past_due"
                                elif mp_status == "cancelled":
                                    suscripcion.estado = "cancelada"

                                suscripcion.mp_preapproval_id = mp_id
                                suscripcion.save()
                            except Suscripcion.DoesNotExist:
                                pass
                except Exception as e:
                    logger.error(f"Error procesando webhook Mercado Pago: {e}")

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
