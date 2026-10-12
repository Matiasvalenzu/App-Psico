from celery import shared_task

from . import bhe


@shared_task
def procesar_emision_bhe(emision_id):
    bhe.procesar(emision_id)


@shared_task
def conciliar_emision_bhe(emision_id, busqueda):
    bhe.conciliar(emision_id, busqueda)


@shared_task
def rescatar_emisiones_bhe():
    bhe.rescatar_colgadas()
