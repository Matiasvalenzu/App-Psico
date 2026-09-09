from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pacientes.models import Paciente
from evaluaciones.catalog import (
    ELLIS_SLUG,
    RUEDA_CREENCIAS_SLUG,
    evaluate_rueda_creencias,
    get_test,
    list_tests,
)
from evaluaciones.models import EvaluacionAsignada
from evaluaciones.services import generate_token, hash_token, complete_assignment

User = get_user_model()


class EvaluacionesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.psicologo = User.objects.create_user(
            username="psico_test",
            email="psico@test.com",
            password="testpass123",
            first_name="Matías",
            last_name="Valenzuela",
        )
        self.paciente = Paciente.objects.create(
            psicologo=self.psicologo,
            nombre="Laura",
            apellido="Gómez",
            email_contacto="laura.gomez@test.com",
            motivo_consulta="Ansiedad por autoexigencia laboral",
        )
        self.client.force_authenticate(user=self.psicologo)

    def test_catalog_contains_both_tests(self):
        tests = list_tests()
        slugs = [t["slug"] for t in tests]
        self.assertIn(RUEDA_CREENCIAS_SLUG, slugs)
        self.assertIn(ELLIS_SLUG, slugs)

        rueda = get_test(RUEDA_CREENCIAS_SLUG)
        self.assertEqual(rueda["name"], "Rueda de Creencias Limitantes")
        self.assertEqual(len(rueda["dimensions"]), 10)
        self.assertEqual(len(rueda["questions"]), 10)

    def test_evaluate_rueda_creencias_logic(self):
        sample_responses = {
            "1": {"actual": 9, "deseado": 2},  # Necesidad de aprobación: ALTO, brecha 7
            "2": {"actual": 8, "deseado": 3},  # Perfeccionismo: ALTO, brecha 5
            "3": {"actual": 4, "deseado": 3},  # Etiquetas: BAJO, brecha 1
            "4": {"actual": 7, "deseado": 2},  # Magnificación: MODERADO, brecha 5
            "5": {"actual": 3, "deseado": 2},  # Externalización: BAJO, brecha 1
            "6": {"actual": 9, "deseado": 1},  # Adivinación: ALTO, brecha 8
            "7": {"actual": 5, "deseado": 2},  # Evitación: MODERADO, brecha 3
            "8": {"actual": 2, "deseado": 2},  # Grandiosidad: BAJO, brecha 0
            "9": {"actual": 6, "deseado": 2},  # Sobregeneralización: MODERADO, brecha 4
            "10": {"actual": 4, "deseado": 2}, # Hedonismo: BAJO, brecha 2
        }
        result = evaluate_rueda_creencias(sample_responses)
        self.assertEqual(result["test_slug"], RUEDA_CREENCIAS_SLUG)
        self.assertEqual(result["total_score"], 57)
        self.assertEqual(result["promedio_actual"], 5.7)

        # Highest dimensions should have scores 9, 9, 8
        highest_ids = [dim["id"] for dim in result["highest_dimensions"]]
        self.assertIn(1, highest_ids)  # Necesidad de aprobación
        self.assertIn(6, highest_ids)  # Adivinación/Catastrofismo
        self.assertIn(2, highest_ids)  # Perfeccionismo

        # Check gap calculations
        dim_1 = next(d for d in result["dimensions"] if d["id"] == 1)
        self.assertEqual(dim_1["brecha"], 7)
        self.assertEqual(dim_1["level"], "ALTO")

    def test_assign_and_submit_rueda_creencias(self):
        # 1. Psychologist assigns Rueda test
        res = self.client.post(
            "/evaluaciones/asignaciones/",
            {"paciente": self.paciente.id, "test_slug": RUEDA_CREENCIAS_SLUG},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        asignacion_id = res.data["id"]
        asignacion = EvaluacionAsignada.objects.get(id=asignacion_id)
        self.assertEqual(asignacion.test_slug, RUEDA_CREENCIAS_SLUG)

        # Extract token from public url
        token = asignacion.enlace_generado.split("/")[-1]

        # 2. Public view load
        public_client = APIClient()
        pub_res = public_client.get(f"/evaluaciones/publicas/{token}/")
        self.assertEqual(pub_res.status_code, 200)
        self.assertEqual(pub_res.data["test"]["slug"], RUEDA_CREENCIAS_SLUG)
        self.assertEqual(len(pub_res.data["test"]["questions"]), 10)

        # 3. Patient submits responses
        responses = {
            str(i): {"actual": 8 if i in [1, 2] else 4, "deseado": 2}
            for i in range(1, 11)
        }
        submit_res = public_client.post(
            f"/evaluaciones/publicas/{token}/responder/",
            {"respuestas": responses},
            format="json",
        )
        self.assertEqual(submit_res.status_code, 200)

        # 4. Verify completion and session creation
        asignacion.refresh_from_db()
        self.assertEqual(asignacion.estado, EvaluacionAsignada.Estado.COMPLETADO)
        self.assertIsNotNone(asignacion.sesion)
        self.assertEqual(asignacion.sesion.documento_nombre_original, "Rueda de Creencias Limitantes")
        self.assertEqual(asignacion.resultado.puntajes["test_slug"], RUEDA_CREENCIAS_SLUG)

    def test_assign_immediate_in_session_without_email(self):
        # Patient without email
        self.paciente.email_contacto = ""
        self.paciente.save()

        # Psychologist starts test immediately (in session / remote)
        res = self.client.post(
            "/evaluaciones/asignaciones/",
            {
                "paciente": self.paciente.id,
                "test_slug": RUEDA_CREENCIAS_SLUG,
                "enviar_email": False,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("token", res.data)
        self.assertIn("public_url", res.data)
        self.assertFalse(res.data["email_enviado"])

        token = res.data["token"]
        public_client = APIClient()
        pub_res = public_client.get(f"/evaluaciones/publicas/{token}/")
        self.assertEqual(pub_res.status_code, 200)

        responses = {
            str(i): {"actual": 7, "deseado": 3}
            for i in range(1, 11)
        }
        submit_res = public_client.post(
            f"/evaluaciones/publicas/{token}/responder/",
            {"respuestas": responses},
            format="json",
        )
        self.assertEqual(submit_res.status_code, 200)
        self.assertEqual(submit_res.data["paciente_id"], self.paciente.id)
        self.assertIsNotNone(submit_res.data["sesion_id"])

