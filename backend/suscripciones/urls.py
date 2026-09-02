from django.urls import path
from .views import SuscripcionEstadoView, CheckoutView, WebhookView

app_name = 'suscripciones'

urlpatterns = [
    path('estado/', SuscripcionEstadoView.as_view(), name='estado'),
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('webhook/', WebhookView.as_view(), name='webhook'),
]
