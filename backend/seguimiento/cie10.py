"""Subconjunto CIE-10 (OPS/OMS, español) usado en salud mental: capítulo V (selección) y códigos Z frecuentes.

TODO antes de producción: contrastar descripciones con la versión oficial publicada por MINSAL/DEIS.
"""
import unicodedata

CIE10 = [
    ("F10.2", "Trastornos mentales y del comportamiento debidos al uso de alcohol: síndrome de dependencia"),
    ("F12.1", "Trastornos mentales y del comportamiento debidos al uso de cannabinoides: uso nocivo"),
    ("F20.0", "Esquizofrenia paranoide"),
    ("F23", "Trastornos psicóticos agudos y transitorios"),
    ("F31", "Trastorno afectivo bipolar"),
    ("F31.3", "Trastorno afectivo bipolar, episodio actual depresivo leve o moderado"),
    ("F32", "Episodio depresivo"),
    ("F32.0", "Episodio depresivo leve"),
    ("F32.1", "Episodio depresivo moderado"),
    ("F32.2", "Episodio depresivo grave sin síntomas psicóticos"),
    ("F32.3", "Episodio depresivo grave con síntomas psicóticos"),
    ("F32.9", "Episodio depresivo, no especificado"),
    ("F33", "Trastorno depresivo recurrente"),
    ("F33.1", "Trastorno depresivo recurrente, episodio moderado presente"),
    ("F34.1", "Distimia"),
    ("F40.0", "Agorafobia"),
    ("F40.1", "Fobias sociales"),
    ("F40.2", "Fobias específicas (aisladas)"),
    ("F41.0", "Trastorno de pánico [ansiedad paroxística episódica]"),
    ("F41.1", "Trastorno de ansiedad generalizada"),
    ("F41.2", "Trastorno mixto de ansiedad y depresión"),
    ("F41.9", "Trastorno de ansiedad, no especificado"),
    ("F42", "Trastorno obsesivo-compulsivo"),
    ("F43.0", "Reacción al estrés agudo"),
    ("F43.1", "Trastorno de estrés postraumático"),
    ("F43.2", "Trastornos de adaptación"),
    ("F43.20", "Trastorno de adaptación: reacción depresiva breve"),
    ("F43.22", "Trastorno de adaptación: reacción mixta de ansiedad y depresión"),
    ("F44", "Trastornos disociativos [de conversión]"),
    ("F45.0", "Trastorno de somatización"),
    ("F48.0", "Neurastenia"),
    ("F50.0", "Anorexia nerviosa"),
    ("F50.2", "Bulimia nerviosa"),
    ("F51.0", "Insomnio no orgánico"),
    ("F60.3", "Trastorno de la personalidad emocionalmente inestable"),
    ("F60.31", "Trastorno de la personalidad emocionalmente inestable, tipo límite"),
    ("F60.5", "Trastorno anancástico de la personalidad"),
    ("F60.6", "Trastorno de la personalidad ansiosa (evasiva, elusiva)"),
    ("F60.7", "Trastorno de la personalidad dependiente"),
    ("F63.0", "Juego patológico"),
    ("F64.0", "Transexualismo"),
    ("F70", "Retraso mental leve"),
    ("F80.1", "Trastorno del lenguaje expresivo"),
    ("F81.0", "Trastorno específico de la lectura"),
    ("F84.0", "Autismo en la niñez"),
    ("F84.5", "Síndrome de Asperger"),
    ("F90.0", "Perturbación de la actividad y de la atención"),
    ("F90.1", "Trastorno hipercinético de la conducta"),
    ("F91.3", "Trastorno opositor desafiante"),
    ("F93.0", "Trastorno de ansiedad de separación en la niñez"),
    ("F94.0", "Mutismo electivo"),
    ("F95.2", "Trastorno por tics combinados vocales y motores múltiples [de la Tourette]"),
    ("F98.0", "Enuresis no orgánica"),
    ("Z55.9", "Problemas relacionados con la educación y la alfabetización, no especificados"),
    ("Z56.6", "Otras tensiones físicas o mentales relacionadas con el trabajo"),
    ("Z60.0", "Problemas relacionados con el ajuste a las transiciones del ciclo vital"),
    ("Z61.6", "Problemas relacionados con abuso físico alegado del niño"),
    ("Z63.0", "Problemas en la relación entre esposos o pareja"),
    ("Z63.4", "Desaparición o muerte de un miembro de la familia"),
    ("Z63.5", "Ruptura familiar por separación o divorcio"),
    ("Z63.8", "Otros problemas especificados relacionados con el grupo primario de apoyo"),
    ("Z65.3", "Problemas relacionados con otras circunstancias legales"),
    ("Z73.0", "Problemas relacionados con la enfermedad consuntiva (agotamiento)"),
    ("Z73.3", "Problemas relacionados con el estrés, no clasificados en otra parte"),
    ("Z91.5", "Historia personal de lesión autoinfligida"),
]


def _norm(t):
    t = unicodedata.normalize("NFKD", t or "")
    return "".join(c for c in t if not unicodedata.combining(c)).lower()


def buscar(q, limite=20):
    q = _norm(q).strip()
    if not q:
        return [{"codigo": c, "descripcion": d} for c, d in CIE10[:limite]]
    res = [{"codigo": c, "descripcion": d} for c, d in CIE10 if _norm(c).startswith(q) or q in _norm(d)]
    return res[:limite]


def descripcion_de(codigo):
    return next((d for c, d in CIE10 if c.lower() == (codigo or "").lower()), None)
