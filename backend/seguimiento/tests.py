from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from pacientes.models import Paciente
from suscripciones.models import Suscripcion
from sesiones.models import Sesion, TranscripcionSegmento

from .escalas import DASS21, GAD7, PHQ9, RSES, calcular_escala
from .ia import construir_contexto, generar_documento
from .models import AplicacionEscala, DocumentoClinicoIA, RegistroAnimo, TareaIntersesion

User = get_user_model()


def resp(escala, valores):
    return {str(p["id"]): v for p, v in zip(escala["preguntas"], valores)}


class PuntajeEscalasTests(TestCase):
    def test_phq9_cortes(self):
        for total, codigo in [(4, "minima"), (5, "leve"), (9, "leve"), (10, "moderada"), (14, "moderada"), (15, "moderada-grave"), (19, "moderada-grave"), (20, "grave"), (27, "grave")]:
            vals = [0] * 9
            restante = total
            for i in range(8):  # sin tocar el ítem 9
                vals[i] = min(3, restante)
                restante -= vals[i]
            vals[8] = restante
            _, r = calcular_escala(PHQ9, resp(PHQ9, vals))
            self.assertEqual((r["total"], r["severidad"]), (total, codigo))

    def test_phq9_alerta_independiente_del_total(self):
        vals = [1, 1, 0, 0, 0, 0, 0, 0, 1]
        _, r = calcular_escala(PHQ9, resp(PHQ9, vals))
        self.assertEqual(r["total"], 3)
        self.assertEqual(r["severidad"], "minima")
        self.assertEqual(len(r["alertas_riesgo"]), 1)
        self.assertEqual(r["alertas_riesgo"][0]["pregunta_id"], 9)
        self.assertTrue(r["alertas_riesgo"][0]["validada"])

    def test_gad7_cortes(self):
        for total, codigo in [(4, "minima"), (5, "leve"), (9, "leve"), (10, "moderada"), (14, "moderada"), (15, "grave")]:
            vals = [0] * 7
            restante = total
            for i in range(7):
                vals[i] = min(3, restante)
                restante -= vals[i]
            _, r = calcular_escala(GAD7, resp(GAD7, vals))
            self.assertEqual(r["severidad"], codigo, total)
            self.assertEqual(r["alertas_riesgo"], [])

    def test_dass21_subescalas_por_dos_sin_total(self):
        vals = [0] * 21
        # Depresión: ítems 3,5,13 = 2 -> 6*2 = 12 (leve)
        for i in (3, 5, 13):
            vals[i - 1] = 2
        _, r = calcular_escala(DASS21, resp(DASS21, vals))
        self.assertIsNone(r["total"])
        sub = {s["clave"]: s for s in r["subescalas"]}
        self.assertEqual(sub["D"]["puntaje"], 12)
        self.assertEqual(sub["D"]["severidad"], "leve")
        self.assertEqual(sub["A"]["severidad"], "normal")
        self.assertEqual(r["alertas_riesgo"], [])
        vals[21 - 1] = 2
        _, r = calcular_escala(DASS21, resp(DASS21, vals))
        self.assertFalse(r["alertas_riesgo"][0]["validada"])

    def test_rses_inversos_y_cortes(self):
        _, r = calcular_escala(RSES, resp(RSES, [4] * 10))
        self.assertEqual(r["total"], 25)  # 5*4 + 5*1
        self.assertEqual(r["severidad"], "baja")
        _, r = calcular_escala(RSES, resp(RSES, [4] * 5 + [2] * 4 + [1]))
        self.assertEqual(r["total"], 20 + 12 + 4)
        self.assertEqual(r["severidad"], "elevada")

    def test_respuestas_incompletas_o_invalidas(self):
        with self.assertRaises(ValueError):
            calcular_escala(GAD7, {"1": 0})
        with self.assertRaises(ValueError):
            calcular_escala(GAD7, resp(GAD7, [0, 0, 0, 0, 0, 0, 7]))


@override_settings(PUBLIC_APP_URL="https://app.example.test")
class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.psico = User.objects.create_user(username="psico_demo", email="psico.demo@example.test", password="x", first_name="Demo", last_name="Psicóloga")
        self.otro = User.objects.create_user(username="otro", email="otro@example.test", password="x")
        self.paciente = Paciente.objects.create(psicologo=self.psico, nombre="Sofía", apellido="Ficticia", telefono_whatsapp="+56 9 1234 5678", motivo_consulta="Ansiedad (dato ficticio)")
        Suscripcion.objects.update_or_create(user=self.psico, defaults={"plan": "plus", "estado": "activa"})
        self.psico = User.objects.get(pk=self.psico.pk)
        self.client.force_authenticate(self.psico)
        self.base = f"/api/seguimiento/pacientes/{self.paciente.id}"

    def test_aplicar_en_consulta_y_trayectoria(self):
        for vals in ([2] * 9, [1] * 9):
            r = self.client.post(f"{self.base}/escalas/", {"escala": "phq-9", "canal": "EN_CONSULTA", "respuestas": resp(PHQ9, vals)}, format="json")
            self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["alerta_riesgo"])
        t = self.client.get(f"{self.base}/trayectoria/").data
        self.assertEqual(len(t["escalas"][0]["puntos"]), 2)
        self.assertEqual(t["escalas"][0]["puntos"][0]["total"], 18)
        self.assertEqual(len(mail.outbox), 0)  # en consulta no se envía correo
        alertas = self.client.get("/api/seguimiento/escalas/alertas/").data
        self.assertEqual(len(alertas), 2)
        self.client.post(f"/api/seguimiento/escalas/aplicaciones/{alertas[0]['id']}/revisar-alerta/")
        self.assertEqual(len(self.client.get("/api/seguimiento/escalas/alertas/").data), 1)

    def test_otro_psicologo_no_ve_trayectoria(self):
        c = APIClient()
        c.force_authenticate(self.otro)
        self.assertEqual(c.get(f"{self.base}/trayectoria/").status_code, 404)

    def test_enlace_no_envia_nada_y_flujo_publico(self):
        r = self.client.post(f"{self.base}/escalas/", {"escala": "phq-9", "canal": "ENLACE"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["whatsapp_url"].startswith("https://wa.me/56912345678?text="))
        self.assertNotIn("PHQ", r.data["mensaje"])
        self.assertEqual(len(mail.outbox), 0)
        token = r.data["enlace"].rsplit("/", 1)[1]
        pub = APIClient()
        g = pub.get(f"/api/seguimiento/escalas/publica/{token}/")
        self.assertEqual(g.status_code, 200)
        self.assertNotIn("cortes", g.data["cuestionario"])
        bad = pub.post(f"/api/seguimiento/escalas/publica/{token}/", {"respuestas": {"1": 0}}, format="json")
        self.assertEqual(bad.status_code, 400)
        with self.captureOnCommitCallbacks(execute=True):
            ok = pub.post(f"/api/seguimiento/escalas/publica/{token}/", {"respuestas": resp(PHQ9, [0] * 8 + [2])}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data["riesgo"])
        self.assertNotIn("total", ok.data)
        self.assertEqual(len(mail.outbox), 1)  # aviso solo al psicólogo
        self.assertEqual(mail.outbox[0].to, ["psico.demo@example.test"])
        self.assertNotIn("Sofía", mail.outbox[0].body)
        again = pub.post(f"/api/seguimiento/escalas/publica/{token}/", {"respuestas": resp(PHQ9, [0] * 9)}, format="json")
        self.assertEqual(again.status_code, 410)

    def test_enlace_vencido_y_cancelado(self):
        r = self.client.post(f"{self.base}/escalas/", {"escala": "gad-7", "canal": "ENLACE"}, format="json")
        token = r.data["enlace"].rsplit("/", 1)[1]
        AplicacionEscala.objects.filter(pk=r.data["id"]).update(expira_en=timezone.now() - timedelta(minutes=1))
        self.assertEqual(APIClient().get(f"/api/seguimiento/escalas/publica/{token}/").status_code, 410)
        self.assertEqual(APIClient().get("/api/seguimiento/escalas/publica/no-existe/").status_code, 404)

    def test_tareas_animo_y_portal(self):
        t = self.client.post(f"{self.base}/tareas/", {"descripcion": "Registrar pensamientos automáticos", "fecha_entrega": str(timezone.localdate() - timedelta(days=1))}, format="json")
        self.assertEqual(t.status_code, 201)
        self.assertTrue(t.data["vencida"])
        oculta = TareaIntersesion.objects.create(paciente=self.paciente, psicologo=self.psico, descripcion="Nota interna", visible_para_paciente=False)
        self.assertEqual(self.client.post(f"{self.base}/animo/", {"valor": 11}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"{self.base}/animo/", {"valor": 6, "nota": "ficticio"}, format="json").status_code, 201)
        self.assertEqual(self.client.post(f"{self.base}/animo/", {"valor": 7}, format="json").status_code, 201)
        self.assertEqual(RegistroAnimo.objects.filter(paciente=self.paciente).count(), 1)  # mismo día se actualiza
        p = self.client.post(f"{self.base}/portal/")
        self.assertEqual(len(mail.outbox), 0)
        token = p.data["enlace"].rsplit("/", 1)[1]
        pub = APIClient()
        g = pub.get(f"/api/seguimiento/portal/{token}/")
        self.assertEqual(g.status_code, 200)
        ids = [x["id"] for x in g.data["tareas"]]
        self.assertIn(t.data["id"], ids)
        self.assertNotIn(oculta.id, ids)
        self.assertEqual(pub.post(f"/api/seguimiento/portal/{token}/tareas/{oculta.id}/completar/", {}, format="json").status_code, 404)
        c = pub.post(f"/api/seguimiento/portal/{token}/tareas/{t.data['id']}/completar/", {"nota": "Lo hice 4 noches"}, format="json")
        self.assertEqual(c.status_code, 200)
        a = pub.post(f"/api/seguimiento/portal/{token}/animo/", {"valor": 2, "emociones": ["tristeza", "inventada"]}, format="json")
        self.assertTrue(a.data["mostrar_ayuda"])
        reg = RegistroAnimo.objects.get(paciente=self.paciente, registrado_por="PACIENTE")
        self.assertEqual(reg.emociones, ["tristeza"])
        tarea = TareaIntersesion.objects.get(pk=t.data["id"])
        self.assertEqual((tarea.completada, tarea.completada_por, tarea.nota_paciente), (True, "PACIENTE", "Lo hice 4 noches"))
        self.client.delete(f"{self.base}/portal/")
        self.assertEqual(pub.get(f"/api/seguimiento/portal/{token}/").status_code, 410)

    def test_cie10_y_licencia_requiere_diagnostico(self):
        self.assertTrue(any(x["codigo"] == "F41.1" for x in self.client.get("/api/seguimiento/cie10/?q=ansiedad generalizada").data))
        r = self.client.post(f"{self.base}/informes/", {"tipo": "LICENCIA"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.client.put(f"{self.base}/diagnostico/", {"codigo": "F41.1", "presuntivo": True}, format="json")
        self.assertEqual(self.client.get(f"{self.base}/diagnostico/").data["descripcion"], "Trastorno de ansiedad generalizada")

    @override_settings(DEEPSEEK_API_KEY="test-key")
    @patch("seguimiento.ia.llamar_deepseek", return_value=("DÓNDE QUEDAMOS: [Paciente] habló de su trabajo.", "deepseek-chat"))
    def test_brief_seudonimiza_y_desseudonimiza(self, mock_llm):
        s = Sesion.objects.create(paciente=self.paciente, psicologo=self.psico, estado=Sesion.Estado.COMPLETADO)
        TranscripcionSegmento.objects.create(sesion=s, orden=1, inicio_segundo=0, fin_segundo=3, hablante="PACIENTE", texto="Soy Sofía Ficticia y estoy cansada.")
        self.client.post(f"{self.base}/escalas/", {"escala": "gad-7", "canal": "EN_CONSULTA", "respuestas": resp(GAD7, [1] * 7)}, format="json")
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client.post(f"{self.base}/brief/")
        self.assertEqual(r.status_code, 202)
        doc = DocumentoClinicoIA.objects.get(pk=r.data["id"])
        self.assertEqual(doc.estado, "LISTO", doc.error)
        enviado = mock_llm.call_args[0][1]
        self.assertNotIn("Sofía", enviado)
        self.assertNotIn("Ficticia", enviado)
        self.assertIn("GAD-7", enviado)
        self.assertIn("Sofía Ficticia", doc.contenido)
        self.assertIn("Sin registro de ánimo en el período.", doc.advertencias)

    @override_settings(DEEPSEEK_API_KEY="test-key")
    @patch("seguimiento.ia.llamar_deepseek", return_value=("INFORME\nTexto [COMPLETAR: curso]", "deepseek-chat"))
    def test_informe_final_no_regenera_y_exporta(self, _):
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client.post(f"{self.base}/informes/", {"tipo": "COLEGIO", "destinatario": "Colegio Ficticio"}, format="json")
        self.assertEqual(r.status_code, 202)
        doc_id = r.data["id"]
        self.assertIn("La ficha no tiene diagnóstico CIE-10.", r.data["advertencias"])
        self.assertEqual(self.client.post(f"/api/seguimiento/documentos/{doc_id}/finalizar/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/seguimiento/documentos/{doc_id}/regenerar/").status_code, 400)
        pdf = self.client.get(f"/api/seguimiento/documentos/{doc_id}/exportar/pdf/")
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(b"".join(pdf.streaming_content).startswith(b"%PDF"))
        docx = self.client.get(f"/api/seguimiento/documentos/{doc_id}/exportar/docx/")
        self.assertEqual(docx.status_code, 200)

    def test_ia_sin_configurar_queda_en_error(self):
        doc = DocumentoClinicoIA.objects.create(paciente=self.paciente, psicologo=self.psico, tipo="BRIEF")
        with override_settings(DEEPSEEK_API_KEY=""):
            generar_documento(doc.id)
        doc.refresh_from_db()
        self.assertEqual(doc.estado, "ERROR")

    def test_contexto_excluye_rut(self):
        self.paciente.rut = "11.111.111-1"
        self.paciente.save()
        ctx, _ = construir_contexto(self.paciente)
        self.assertNotIn("11.111.111-1", ctx)


class GatingPlanTests(TestCase):
    def setUp(self):
        self.psico = User.objects.create_user(username="estandar_demo", email="estandar@example.test", password="x")
        Suscripcion.objects.update_or_create(user=self.psico, defaults={"plan": "estandar", "estado": "activa"})
        self.psico = User.objects.get(pk=self.psico.pk)
        self.paciente = Paciente.objects.create(psicologo=self.psico, nombre="Demo", apellido="Estandar")
        self.client = APIClient()
        self.client.force_authenticate(self.psico)
        self.base = f"/api/seguimiento/pacientes/{self.paciente.id}"

    def test_estandar_no_accede_a_brief_ni_informes(self):
        for metodo, url, body in [("post", f"{self.base}/brief/", None), ("get", f"{self.base}/brief/", None),
                                  ("post", f"{self.base}/informes/", {"tipo": "COLEGIO"}), ("get", f"{self.base}/informes/", None)]:
            r = getattr(self.client, metodo)(url, body, format="json")
            self.assertEqual(r.status_code, 403, url)
            self.assertEqual(r.data["code"], "requiere_plus")
        doc = DocumentoClinicoIA.objects.create(paciente=self.paciente, psicologo=self.psico, tipo="COLEGIO", estado="LISTO")
        self.assertEqual(self.client.get(f"/api/seguimiento/documentos/{doc.id}/exportar/pdf/").status_code, 403)

    def test_trial_vigente_accede_a_brief_e_informes_y_el_vencido_no(self):
        suscripcion = self.psico.suscripcion
        suscripcion.estado = "trial"
        suscripcion.plan = "estandar"
        suscripcion.fin_prueba = timezone.now() + timedelta(days=3)
        suscripcion.save()
        for url in (f"{self.base}/brief/", f"{self.base}/informes/"):
            r = self.client.get(url)
            self.assertNotEqual(r.status_code, 403, url)
        suscripcion.fin_prueba = timezone.now() - timedelta(hours=1)
        suscripcion.save()
        for url in (f"{self.base}/brief/", f"{self.base}/informes/"):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 403, url)
            self.assertEqual(r.data["code"], "requiere_plus")

    def test_estandar_si_accede_a_escalas_tareas_y_animo(self):
        r = self.client.post(f"{self.base}/escalas/", {"escala": "gad-7", "canal": "EN_CONSULTA", "respuestas": resp(GAD7, [0] * 7)}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.get(f"{self.base}/trayectoria/").status_code, 200)
        self.assertEqual(self.client.post(f"{self.base}/tareas/", {"descripcion": "Caminar 20 minutos"}, format="json").status_code, 201)
        self.assertEqual(self.client.post(f"{self.base}/animo/", {"valor": 6}, format="json").status_code, 201)
        self.assertEqual(self.client.post(f"{self.base}/portal/").status_code, 201)
