from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pacientes.models import Paciente
from evaluaciones.catalog import (
    ELLIS_SLUG,
    RUEDA_CREENCIAS_SLUG,
    RUEDA_VIDA_SLUG,
    evaluate_rueda_vida,
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
        self.assertIn(RUEDA_VIDA_SLUG, slugs)
        self.assertIn(ELLIS_SLUG, slugs)

        rueda = get_test(RUEDA_VIDA_SLUG)
        self.assertEqual(rueda["name"], "Rueda de la Vida")
        self.assertEqual(len(rueda["dimensions"]), 10)
        self.assertEqual(len(rueda["questions"]), 10)

    def test_evaluate_rueda_vida_logic(self):
        sample_responses = {
            "1": 9,  # Salud: ALTO
            "2": 8,  # Dinero: ALTO
            "3": 4,  # Trabajo: BAJO
            "4": 7,  # Amor: MODERADO
            "5": 3,  # Familia: BAJO
            "6": 9,  # Amigos: ALTO
            "7": 5,  # Ocio: MODERADO
            "8": 2,  # Hogar: BAJO
            "9": 6,  # Crecimiento personal: MODERADO
            "10": 4, # Espiritualidad: BAJO
        }
        result = evaluate_rueda_vida(sample_responses)
        self.assertEqual(result["test_slug"], RUEDA_VIDA_SLUG)
        self.assertEqual(result["total_score"], 57)
        self.assertEqual(result["promedio_actual"], 5.7)

        # Highest dimensions should have scores 9, 9, 8
        highest_ids = [dim["id"] for dim in result["highest_dimensions"]]
        self.assertIn(1, highest_ids)  # Salud
        self.assertIn(6, highest_ids)  # Amigos
        self.assertIn(2, highest_ids)  # Dinero

        dim_1 = next(d for d in result["dimensions"] if d["id"] == 1)
        self.assertEqual(dim_1["score"], 9)
        self.assertEqual(dim_1["level"], "ALTO")

    def test_assign_and_submit_rueda_vida(self):
        # 1. Psychologist assigns Rueda test
        res = self.client.post(
            "/api/evaluaciones/asignaciones/",
            {"paciente": self.paciente.id, "test_slug": RUEDA_VIDA_SLUG},
            format="json",
            secure=True,
        )
        self.assertEqual(res.status_code, 201)
        asignacion_id = res.data["id"]
        asignacion = EvaluacionAsignada.objects.get(id=asignacion_id)
        self.assertEqual(asignacion.test_slug, RUEDA_VIDA_SLUG)

        # Extract token from public url
        token = asignacion.enlace_generado.split("/")[-1]

        # 2. Public view load
        public_client = APIClient()
        pub_res = public_client.get(f"/api/evaluaciones/publicas/{token}/", secure=True)
        self.assertEqual(pub_res.status_code, 200)
        self.assertEqual(pub_res.data["test"]["slug"], RUEDA_VIDA_SLUG)
        self.assertEqual(len(pub_res.data["test"]["questions"]), 10)

        # 3. Patient submits responses (single 1-10 scores)
        responses = {
            str(i): 8 if i in [1, 2] else 4
            for i in range(1, 11)
        }
        submit_res = public_client.post(
            f"/api/evaluaciones/publicas/{token}/responder/",
            {"respuestas": responses},
            format="json",
            secure=True,
        )
        self.assertEqual(submit_res.status_code, 200)

        # 4. Verify completion and session creation
        asignacion.refresh_from_db()
        self.assertEqual(asignacion.estado, EvaluacionAsignada.Estado.COMPLETADO)
        self.assertIsNotNone(asignacion.sesion)
        self.assertEqual(asignacion.sesion.documento_nombre_original, "Rueda de la Vida")
        self.assertEqual(asignacion.resultado.puntajes["test_slug"], RUEDA_VIDA_SLUG)

    def test_assign_immediate_in_session_without_email(self):
        # Patient without email
        self.paciente.email_contacto = ""
        self.paciente.save()

        # Psychologist starts test immediately (in session / remote)
        res = self.client.post(
            "/api/evaluaciones/asignaciones/",
            {
                "paciente": self.paciente.id,
                "test_slug": RUEDA_VIDA_SLUG,
                "enviar_email": False,
            },
            format="json",
            secure=True,
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("token", res.data)
        self.assertIn("public_url", res.data)
        self.assertFalse(res.data["email_enviado"])

        token = res.data["token"]
        public_client = APIClient()
        pub_res = public_client.get(f"/api/evaluaciones/publicas/{token}/", secure=True)
        self.assertEqual(pub_res.status_code, 200)

        responses = {
            str(i): 7
            for i in range(1, 11)
        }
        submit_res = public_client.post(
            f"/api/evaluaciones/publicas/{token}/responder/",
            {"respuestas": responses},
            format="json",
            secure=True,
        )
        self.assertEqual(submit_res.status_code, 200)
        self.assertEqual(submit_res.data["paciente_id"], self.paciente.id)
        self.assertIsNotNone(submit_res.data["sesion_id"])

