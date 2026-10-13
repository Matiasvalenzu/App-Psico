"""Estado de pago de los cobros: independiente de la boleta, no toca la emisión en el SII."""

from django.db import transaction

from .models import CambioEstadoPago, Cobro


def cambiar_estado_pago(cobro, estado, usuario, pagado_el=None):
    """Marca el cobro como pagado (con su fecha) o pendiente y deja registro de quién lo cambió."""
    with transaction.atomic():
        # Bloquea la fila: el robot de emisión guarda el cobro completo y podría pisar el cambio.
        cobro = Cobro.objects.select_for_update().get(pk=cobro.pk)
        anterior = cobro.estado_pago
        cobro.estado_pago = estado
        cobro.pagado_el = pagado_el if estado == Cobro.EstadoPago.PAGADO else None
        cobro.save(update_fields=["estado_pago", "pagado_el", "updated_at"])
        CambioEstadoPago.objects.create(
            cobro=cobro, estado_anterior=anterior, estado_nuevo=estado, pagado_el=cobro.pagado_el, usuario=usuario
        )
    return cobro
