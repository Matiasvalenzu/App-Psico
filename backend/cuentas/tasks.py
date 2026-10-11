from celery import shared_task

from .acceso import purgar_registros_antiguos


@shared_task
def purgar_registros_acceso():
    return purgar_registros_antiguos()
