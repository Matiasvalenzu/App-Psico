from celery import shared_task


@shared_task
def generar_documento_clinico(documento_id):
    from .ia import generar_documento

    generar_documento(documento_id)
