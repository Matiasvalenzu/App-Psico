from django.urls import path
from .views import SuscripcionEstadoView, CheckoutView

app_name = 'suscripciones'

urlpatterns = [
    path('estado/', SuscripcionEstadoView.as_view(), name='estado'),
    path('checkout/', CheckoutView.as_view(), name='checkout'),
]
