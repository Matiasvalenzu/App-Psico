from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from chat.models import ChatConversacion
from chat.seudonimo import seudonimizar
from pacientes.models import Paciente
from sesiones.models import Sesion, TranscripcionSegmento

User = get_user_model()


class SeudonimoTests(SimpleTestCase):
    def setUp(self):
        self.paciente = Paciente(
            nombre="José Ignacio", apellido="Muñoz", nombre_tutor="Ana Pérez", contacto_emergencia_nombre=""
        )

    def test_reemplaza_nombre_sin_importar_tildes_ni_mayusculas(self):
        texto = "JOSE ignacio Munoz dijo que su mamá Ana Perez lo llamó. José llegó tarde."
        self.assertEqual(
            seudonimizar(texto, self.paciente),
            "[Paciente] dijo que su mamá [Tutor] lo llamó. [Paciente] llegó tarde.",
        )

    def test_no_toca_palabras_que_contienen_el_nombre(self):
        self.assertEqual(seudonimizar("Anabel y anatomía", self.paciente), "Anabel y anatomía")


class ChatSeudonimizadoTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="psi_chat", email="c@test.com", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.paciente = Paciente.objects.create(
            psicologo=self.user,
            nombre="Valentina",
            apellido="Soto",
            ocupacion_laboral="Ingeniera en Minera Escondida",
            motivo_consulta="Valentina consulta por ansiedad",
        )
        sesion = Sesion.objects.create(
            paciente=self.paciente,
            psicologo=self.user,
            origen=Sesion.Origen.DOCUMENTO_EXTERNO,
            estado=Sesion.Estado.COMPLETADO,
            documento_nombre_original="informe_valentina_soto.pdf",
        )
        TranscripcionSegmento.objects.create(
            sesion=sesion,
            orden=1,
            inicio_segundo=0,
            fin_segundo=1,
            hablante=TranscripcionSegmento.Hablante.DOCUMENTO,
            texto="Valentina Soto refiere insomnio.",
        )
        self.conversacion = ChatConversacion.objects.create(paciente=self.paciente, psicologo=self.user)

    @patch("chat.views.generate_text_embedding", return_value=None)
    @patch("chat.views.ChatConversacionViewSet._consultar_deepseek", return_value="ok")
    def test_deepseek_no_recibe_nombre_ni_archivo(self, consultar, _embedding):
        response = self.client.post(
            f"/api/chat/{self.conversacion.id}/enviar_mensaje/",
            {"contenido": "¿Cómo ha dormido Valentina?"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        pregunta, contexto = consultar.call_args.args[:2]
        enviado = f"{pregunta}\n{contexto}".lower()
        for dato in ("valentina", "soto", "informe_", ".pdf", "minera"):
            self.assertNotIn(dato, enviado)
        self.assertIn("[Paciente] refiere insomnio", contexto)
        # La UI sigue mostrando la fuente real al profesional.
        self.assertEqual(response.data["fuentes_json"][0]["documento_nombre_original"], "informe_valentina_soto.pdf")
