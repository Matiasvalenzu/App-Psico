from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
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
        return Response(
            {"detail": "Los pagos en línea estarán disponibles próximamente."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
