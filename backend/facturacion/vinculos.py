"""Asocia o quita sesiones de un cobro sin tocar la glosa ni la boleta."""

from django.db import transaction
from django.db.models import Count

from sesiones.models import Sesion

from .models import CambioVinculoSesion, Cobro


class VinculoInvalido(Exception):
    def __init__(self, detail):
        self.detail = detail


def cobros_sin_sesion(qs):
    return qs.filter(sesion__isnull=True).exclude(sesiones__isnull=False)


def cobro_de_sesion(sesion, excluir_id=None):
    vinculados = sesion.cobros_vinculados.all()
    por_fk = sesion.cobros.all()
    if excluir_id:
        vinculados = vinculados.exclude(pk=excluir_id)
        por_fk = por_fk.exclude(pk=excluir_id)
    return vinculados.first() or por_fk.first()


def ids_vinculadas(cobro):
    ids = set(cobro.sesiones.values_list("id", flat=True))
    if cobro.sesion_id:
        ids.add(cobro.sesion_id)
    return ids


def aplicar_vinculo(cobro, sesion_ids, usuario):
    """Reemplaza las sesiones del cobro. No modifica glosa, folio ni estado de la boleta."""
    if not isinstance(sesion_ids, list) or any(not isinstance(item, int) for item in sesion_ids):
        raise VinculoInvalido("Indica las sesiones a asociar.")
    with transaction.atomic():
        cobro = Cobro.objects.select_for_update().get(pk=cobro.pk)
        actuales = ids_vinculadas(cobro)
        pedidas = []
        vistos = set()
        for sesion_id in sesion_ids:
            if sesion_id in vistos:
                continue
            vistos.add(sesion_id)
            sesion = Sesion.objects.filter(pk=sesion_id, paciente__psicologo=cobro.psicologo).first()
            if not sesion or (cobro.paciente_id and sesion.paciente_id != cobro.paciente_id):
                raise VinculoInvalido("La sesión no es de este paciente.")
            if cobro_de_sesion(sesion, cobro.pk):
                raise VinculoInvalido("Ya cobrada.")
            pedidas.append(sesion)
        pedidas_ids = {s.id for s in pedidas}
        cobro.sesiones.set(pedidas)
        cobro.sesion = pedidas[0] if len(pedidas) == 1 else None
        cobro.save(update_fields=["sesion", "updated_at"])
        for sesion in pedidas:
            if sesion.id not in actuales:
                CambioVinculoSesion.objects.create(
                    cobro=cobro,
                    sesion=sesion,
                    numero_sesion=sesion.numero_sesion,
                    accion=CambioVinculoSesion.Accion.ASOCIAR,
                    usuario=usuario,
                )
        for sesion_id in actuales - pedidas_ids:
            sesion = Sesion.objects.filter(pk=sesion_id).first()
            CambioVinculoSesion.objects.create(
                cobro=cobro,
                sesion=sesion,
                numero_sesion=sesion.numero_sesion if sesion else None,
                accion=CambioVinculoSesion.Accion.QUITAR,
                usuario=usuario,
            )
    return Cobro.objects.get(pk=cobro.pk)


def sugerir_cobro(qs, fecha):
    desde = fecha.fromordinal(fecha.toordinal() - 15)
    hasta = fecha.fromordinal(fecha.toordinal() + 15)
    candidatos = list(cobros_sin_sesion(qs).filter(fecha_pago__gte=desde, fecha_pago__lte=hasta))
    candidatos.sort(key=lambda c: (abs((c.fecha_pago - fecha).days), -c.id))
    return candidatos[0] if candidatos else None


def contar_sin_sesion(qs):
    return cobros_sin_sesion(qs).count()


def paciente_con_mas_sin_sesion(qs):
    fila = (
        cobros_sin_sesion(qs)
        .filter(paciente__isnull=False)
        .values("paciente")
        .annotate(n=Count("id"))
        .order_by("-n", "paciente")
        .first()
    )
    return fila["paciente"] if fila else None
