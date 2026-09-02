from celery import shared_task

from .google_calendar import sync_cita_to_google
from .models import AgendaCita


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=4)
def sync_appointment_to_google(self, appointment_id):
    appointment = AgendaCita.objects.select_related("psicologo", "paciente").get(
        pk=appointment_id
    )
    return sync_cita_to_google(appointment)
