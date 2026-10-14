import io
import json
from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from openpyxl import Workbook
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model

from .importacion import leer_archivo, sugerir_mapeo
from .models import ImportacionPacientes, Paciente

User = get_user_model()
URL = "/api/pacientes/importar/"


def xlsx(filas, nombre="pacientes.xlsx"):
    libro = Workbook()
    hoja = libro.active
    for fila in filas:
        hoja.append(fila)
    salida = io.BytesIO()
    libro.save(salida)
    return SimpleUploadedFile(nombre, salida.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@override_settings(SECURE_SSL_REDIRECT=False)
class ImportacionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("psi_imp", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_mapeo_por_sinonimos_y_por_contenido(self):
        mapeo = sugerir_mapeo(
            ["Nombres", "RUN", "Correo electrónico", "Celular", "Notas clínicas"],
            [["Ana Rojas", "11.111.111-1", "ana@example.com", "987654321", "F32"]],
        )
        self.assertEqual(mapeo["0"], "nombre")
        self.assertEqual(mapeo["1"], "rut")
        self.assertEqual(mapeo["2"], "email")
        self.assertEqual(mapeo["3"], "telefono")
        self.assertNotIn("4", mapeo)

    def test_rut_invalido_y_archivo_malformado(self):
        archivo = xlsx([["nombre", "apellido", "rut"], ["Ana", "Rojas", "12.345.678-9"]])
        previa = self.client.post(f"{URL}previsualizar/", {"archivo": archivo, "mapeo": json.dumps({"0": "nombre", "1": "apellido", "2": "rut"})})
        self.assertEqual(previa.status_code, 200, previa.content)
        self.assertEqual(previa.data["filas"][0]["estado"], "error")
        self.assertIn("RUT", previa.data["filas"][0]["motivos"][0])
        malo = SimpleUploadedFile("roto.xlsx", b"esto no es excel")
        self.assertEqual(self.client.post(f"{URL}analizar/", {"archivo": malo}).status_code, 400)

    def test_duplicado_actualizar_y_deshacer(self):
        Paciente.objects.create(
            psicologo=self.user, nombre="Ana", apellido="Rojas", email_contacto="ana@example.com",
            telefono_whatsapp="+56911111111",
        )
        archivo = xlsx([
            ["nombre", "apellido", "correo", "celular", "diagnostico"],
            ["Ana", "Rojas", "ana@example.com", "987654321", "F32 secreto"],
            ["Luis", "Pérez", "luis@example.com", "912345678", "nota clinica"],
        ])
        mapeo = json.dumps({"0": "nombre", "1": "apellido", "2": "email", "3": "telefono"})
        previa = self.client.post(f"{URL}previsualizar/", {"archivo": xlsx([
            ["nombre", "apellido", "correo", "celular", "diagnostico"],
            ["Ana", "Rojas", "ana@example.com", "987654321", "F32 secreto"],
            ["Luis", "Pérez", "luis@example.com", "912345678", "nota clinica"],
        ]), "mapeo": mapeo})
        self.assertEqual(previa.data["filas"][0]["duplicado"]["tipo"], "existente")
        self.assertIn("diagnostico", " ".join(previa.data["columnas_ignoradas"]))
        confirm = self.client.post(
            f"{URL}confirmar/",
            {"archivo": archivo, "mapeo": mapeo, "decisiones": json.dumps({"1": "actualizar"})},
        )
        self.assertEqual(confirm.status_code, 201, confirm.content)
        self.assertEqual((confirm.data["creados"], confirm.data["actualizados"], confirm.data["omitidos"]), (1, 1, 0))
        ana = Paciente.objects.get(email_contacto="ana@example.com")
        self.assertEqual(ana.telefono_whatsapp, "+56987654321")
        self.assertEqual(ana.motivo_consulta, "")
        luis = Paciente.objects.get(nombre="Luis")
        self.assertEqual(luis.telefono_whatsapp, "+56912345678")
        self.assertNotIn("nota", luis.motivo_consulta)
        deshacer = self.client.post(f"{URL}{confirm.data['id']}/deshacer/")
        self.assertEqual(deshacer.status_code, 200, deshacer.content)
        self.assertFalse(Paciente.objects.filter(nombre="Luis").exists())
        ana.refresh_from_db()
        self.assertEqual(ana.telefono_whatsapp, "+56911111111")

    def test_deshacer_vence_a_las_24_horas(self):
        registro = ImportacionPacientes.objects.create(psicologo=self.user, snapshot={"creados": [], "anteriores": []})
        ImportacionPacientes.objects.filter(pk=registro.pk).update(created_at=timezone.now() - timedelta(hours=25))
        self.assertEqual(self.client.post(f"{URL}{registro.id}/deshacer/").status_code, 400)

    def test_csv_y_limite_de_filas(self):
        csv = SimpleUploadedFile("pacientes.csv", "nombre,apellido\nAna,Rojas\n".encode(), content_type="text/csv")
        response = self.client.post(f"{URL}analizar/", {"archivo": csv})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["mapeo"]["0"], "nombre")
        with self.assertRaises(Exception):
            leer_archivo("grande.csv", ("nombre,apellido\n" + "Ana,Rojas\n" * 1001).encode())

    @override_settings(DEEPSEEK_API_KEY="test-key", DEEPSEEK_BASE_URL="https://example.invalid/v1")
    def test_ia_solo_recibe_encabezados_y_tres_filas(self):
        respuesta = mock.Mock(status_code=200)
        respuesta.json.return_value = {"choices": [{"message": {"content": '{"0": "nombre", "1": "email"}'}}]}
        respuesta.raise_for_status.return_value = None
        with mock.patch("requests.post", return_value=respuesta) as post:
            self.client.post(f"{URL}sugerir/", {
                "encabezados": ["Nombre", "Mail"],
                "muestra": [["Ana", "a@example.com"], ["Luis", "l@example.com"], ["Sol", "s@example.com"], ["secreto", "no@enviar.com"]],
            }, format="json")
        cuerpo = post.call_args.kwargs["json"]["messages"][0]["content"]
        self.assertIn("Ana", cuerpo)
        self.assertNotIn("no@enviar.com", cuerpo)
        self.assertNotIn("F32", cuerpo)
