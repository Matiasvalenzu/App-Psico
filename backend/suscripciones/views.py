import json
import mercadopago
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import Suscripcion

class SuscripcionEstadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            suscripcion = request.user.suscripcion
        except Suscripcion.DoesNotExist:
            return Response({"error": "No subscription found"}, status=status.HTTP_404_NOT_FOUND)

        # Update trial status if expired
        if suscripcion.estado == 'trial' and suscripcion.fin_prueba:
            if timezone.now() > suscripcion.fin_prueba:
                suscripcion.estado = 'expirada'
                suscripcion.save()

        return Response({
            "estado": suscripcion.estado,
            "fin_prueba": suscripcion.fin_prueba,
            "is_active_or_trial": suscripcion.is_active_or_trial,
            "mp_preapproval_id": suscripcion.mp_preapproval_id,
        })

class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Generar un preapproval plan en Mercado Pago y retornar la URL
        sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)

        try:
            suscripcion = request.user.suscripcion
        except Suscripcion.DoesNotExist:
            return Response({"error": "No subscription object found"}, status=status.HTTP_400_BAD_REQUEST)

        # Create a preapproval
        preapproval_data = {
            "reason": "Plan Estándar - Psiconex",
            "external_reference": str(request.user.id),
            "payer_email": request.user.email,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": 4990,
                "currency_id": "CLP"
            },
            "back_url": f"{settings.PUBLIC_APP_URL}/dashboard/suscripcion",
            "status": "pending"
        }

        # Send request to MercadoPago API
        preapproval_response = sdk.preapproval().create(preapproval_data)

        if preapproval_response["status"] == 201:
            init_point = preapproval_response["response"]["init_point"]
            # Save the preapproval id
            suscripcion.mp_preapproval_id = preapproval_response["response"]["id"]
            suscripcion.save()
            return Response({"init_point": init_point})
        else:
            return Response(preapproval_response["response"], status=status.HTTP_400_BAD_REQUEST)

class WebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # MercadoPago sends notifications here
        # Example format: {"action": "created", "data": {"id": "123"}, "type": "subscription_preapproval"}
        action = request.data.get("action")
        type_str = request.data.get("type")

        if type_str == "subscription_preapproval":
            sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
            mp_id = request.data.get("data", {}).get("id")
            if mp_id:
                # fetch preapproval
                preapproval_response = sdk.preapproval().get(mp_id)
                if preapproval_response["status"] == 200:
                    data = preapproval_response["response"]
                    user_id = data.get("external_reference")
                    mp_status = data.get("status")

                    if user_id:
                        try:
                            suscripcion = Suscripcion.objects.get(user__id=user_id)
                            # map status: authorized -> activa, paused -> past_due, cancelled -> cancelada
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

        # Always return 200 to acknowledge receipt
        return Response({"status": "ok"}, status=status.HTTP_200_OK)
