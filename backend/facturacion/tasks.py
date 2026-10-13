from celery import shared_task

from . import bhe


@shared_task
def procesar_emision_bhe(emision_id):
    bhe.procesar(emision_id)


@shared_task
def conciliar_emision_bhe(emision_id, busqueda):
    bhe.conciliar(emision_id, busqueda)


@shared_task
def descargar_pdf_bhe(emision_id):
    bhe.descargar_pdf(emision_id)


@shared_task
def rescatar_emisiones_bhe():
    bhe.rescatar_colgadas()


@shared_task
def purgar_evidencias_bhe():
    return bhe.purgar_evidencias()


@shared_task
def revisar_vencimientos_bhe():
    bhe.revisar_vencimientos()


@shared_task
def recordar_anulaciones_bhe():
    bhe.recordar_anulaciones()
