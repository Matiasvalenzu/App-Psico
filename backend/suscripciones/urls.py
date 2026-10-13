from django.urls import path
from .views import (
    SuscripcionEstadoView,
    ContratarCardView,
    CancelarSuscripcionView,
    CambiarPlanView,
    CheckoutView,
    VincularPreapprovalView,
    WebhookView,
)

app_name = 'suscripciones'

urlpatterns = [
    path('estado/', SuscripcionEstadoView.as_view(), name='estado'),
    path('contratar/', ContratarCardView.as_view(), name='contratar'),
    path('cancelar/', CancelarSuscripcionView.as_view(), name='cancelar'),
    path('cambiar-plan/', CambiarPlanView.as_view(), name='cambiar-plan'),
    path('vincular/', VincularPreapprovalView.as_view(), name='vincular'),
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('webhook/', WebhookView.as_view(), name='webhook'),
]
