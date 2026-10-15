from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from pacientes.models import Paciente

from .models import Cobro
from .tests import URL

User = get_user_model()


class UpsellPlusTests(APITestCase):
    def usuario(self, username, **extra):
        user = User.objects.create_user(username=username, email=f"{username}@example.com", password="x")
        for campo, valor in extra.items():
            setattr(user.suscripcion, campo, valor)
        user.suscripcion.save()
        self.client.force_authenticate(user)
        return user

    def test_prueba_vigente_entra_y_estandar_activo_recibe_403(self):
        self.usuario("prueba")
        self.assertEqual(self.client.get(URL, secure=True).status_code, status.HTTP_200_OK)
        self.usuario("estandar", estado="activa", plan="estandar")
        response = self.client.get(URL, secure=True)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "requiere_plus")

    def test_lista_no_revela_deuda_sin_plus(self):
        user = self.usuario("deuda", estado="activa", plan="plus")
        paciente = Paciente.objects.create(psicologo=user, nombre="Ana", apellido="Rojas")
        Cobro.objects.create(
            psicologo=user, paciente=paciente, fecha_pago="2026-10-12", monto_bruto=45000,
            tasa_retencion="15.25", monto_retencion=6862, monto_liquido=38138, glosa="Atención psicológica",
            estado_pago=Cobro.EstadoPago.PENDIENTE,
        )
        user.suscripcion.plan = "estandar"
        user.suscripcion.save()
        fila = self.client.get("/api/pacientes/", secure=True).data["results"][0]
        self.assertIsNone(fila["deuda_pendiente"])
        self.assertIsNone(fila["cobros_pendientes"])

    def test_plus_activo_entra(self):
        user = self.usuario("plus", estado="activa", plan="plus")
        Paciente.objects.create(psicologo=user, nombre="Ana", apellido="Rojas")
        self.assertEqual(self.client.get(URL, secure=True).status_code, status.HTTP_200_OK)

    def test_trial_vigente_tiene_plus_y_el_vencido_no(self):
        user = User(id=22, username="cuenta22", email="cuenta22@example.com")
        user.set_password("x")
        user.save()
        user.suscripcion.estado = "trial"
        user.suscripcion.plan = "estandar"
        user.suscripcion.fin_prueba = timezone.now() + timedelta(days=5)
        user.suscripcion.save()
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(URL, secure=True).status_code, status.HTTP_200_OK)
        user.suscripcion.fin_prueba = timezone.now() - timedelta(hours=1)
        user.suscripcion.save()
        self.assertEqual(self.client.get(URL, secure=True).status_code, status.HTTP_403_FORBIDDEN)
