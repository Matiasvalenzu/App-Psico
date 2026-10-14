"""Catálogo y puntuación de escalas clínicas validadas (PHQ-9, GAD-7, DASS-21, RSES).

Textos según versiones en español de uso habitual; puntos de corte publicados (ver "referencia").
"""

OPC_FRECUENCIA = [
    {"valor": 0, "texto": "Ningún día"},
    {"valor": 1, "texto": "Varios días"},
    {"valor": 2, "texto": "Más de la mitad de los días"},
    {"valor": 3, "texto": "Casi todos los días"},
]
ENUNCIADO_2SEM = "Durante las últimas 2 semanas, ¿qué tan seguido le han afectado los siguientes problemas?"

PHQ9 = {
    "slug": "phq-9",
    "nombre": "PHQ-9",
    "nombre_largo": "Cuestionario de Salud del Paciente (PHQ-9)",
    "dominio": "Depresión",
    "duracion_min": 3,
    "mayor_es_mejor": False,
    "max": 27,
    "instrucciones": ENUNCIADO_2SEM,
    "opciones": OPC_FRECUENCIA,
    "preguntas": [
        {"id": 1, "texto": "Poco interés o placer en hacer cosas."},
        {"id": 2, "texto": "Se ha sentido decaído(a), deprimido(a) o sin esperanzas."},
        {"id": 3, "texto": "Ha tenido dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado."},
        {"id": 4, "texto": "Se ha sentido cansado(a) o con poca energía."},
        {"id": 5, "texto": "Sin apetito o ha comido en exceso."},
        {"id": 6, "texto": "Se ha sentido mal con usted mismo(a), o que es un fracaso, o que ha quedado mal con usted mismo(a) o con su familia."},
        {"id": 7, "texto": "Ha tenido dificultad para concentrarse en ciertas actividades, tales como leer o ver televisión."},
        {"id": 8, "texto": "¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? O lo contrario: muy inquieto(a) o agitado(a), moviéndose mucho más de lo normal."},
        {"id": 9, "texto": "Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera.",
         "riesgo": {"tipo": "ideacion_suicida", "etiqueta": "Ideación suicida", "minimo": 1, "validada": True}},
    ],
    "pregunta_funcional": {
        "id": 10,
        "texto": "Si marcó cualquiera de los problemas, ¿qué tan difícil se le ha hecho cumplir con su trabajo, atender su casa o relacionarse con otras personas?",
        "opciones": [
            {"valor": 0, "texto": "No ha sido difícil"},
            {"valor": 1, "texto": "Un poco difícil"},
            {"valor": 2, "texto": "Muy difícil"},
            {"valor": 3, "texto": "Extremadamente difícil"},
        ],
    },
    "cortes": [
        {"desde": 0, "hasta": 4, "codigo": "minima", "etiqueta": "Mínima"},
        {"desde": 5, "hasta": 9, "codigo": "leve", "etiqueta": "Leve"},
        {"desde": 10, "hasta": 14, "codigo": "moderada", "etiqueta": "Moderada"},
        {"desde": 15, "hasta": 19, "codigo": "moderada-grave", "etiqueta": "Moderadamente severa"},
        {"desde": 20, "hasta": 27, "codigo": "grave", "etiqueta": "Severa"},
    ],
    "referencia": "Kroenke, Spitzer y Williams (2001), J Gen Intern Med; validación chilena: Baader et al. (2012), Rev Chil Neuro-Psiquiat.",
}

GAD7 = {
    "slug": "gad-7",
    "nombre": "GAD-7",
    "nombre_largo": "Escala de Trastorno de Ansiedad Generalizada (GAD-7)",
    "dominio": "Ansiedad",
    "duracion_min": 2,
    "mayor_es_mejor": False,
    "max": 21,
    "instrucciones": ENUNCIADO_2SEM,
    "opciones": OPC_FRECUENCIA,
    "preguntas": [
        {"id": 1, "texto": "Se ha sentido nervioso(a), ansioso(a) o con los nervios de punta."},
        {"id": 2, "texto": "No ha sido capaz de parar o controlar su preocupación."},
        {"id": 3, "texto": "Se ha preocupado demasiado por motivos diferentes."},
        {"id": 4, "texto": "Ha tenido dificultad para relajarse."},
        {"id": 5, "texto": "Se ha sentido tan inquieto(a) que no ha podido quedarse quieto(a)."},
        {"id": 6, "texto": "Se ha molestado o irritado fácilmente."},
        {"id": 7, "texto": "Ha tenido miedo de que algo terrible fuera a pasar."},
    ],
    "cortes": [
        {"desde": 0, "hasta": 4, "codigo": "minima", "etiqueta": "Mínima"},
        {"desde": 5, "hasta": 9, "codigo": "leve", "etiqueta": "Leve"},
        {"desde": 10, "hasta": 14, "codigo": "moderada", "etiqueta": "Moderada"},
        {"desde": 15, "hasta": 21, "codigo": "grave", "etiqueta": "Severa"},
    ],
    "referencia": "Spitzer et al. (2006), Arch Intern Med; versión española: García-Campayo et al. (2010).",
}

_DASS_TEXTOS = [
    ("S", "Me costó mucho relajarme."),
    ("A", "Me di cuenta de que tenía la boca seca."),
    ("D", "No podía sentir ningún sentimiento positivo."),
    ("A", "Se me hizo difícil respirar."),
    ("D", "Se me hizo difícil tomar la iniciativa para hacer cosas."),
    ("S", "Reaccioné exageradamente en ciertas situaciones."),
    ("A", "Sentí que mis manos temblaban."),
    ("S", "Sentí que tenía muchos nervios."),
    ("A", "Estaba preocupado(a) por situaciones en las cuales podía tener pánico o en las que podría hacer el ridículo."),
    ("D", "Sentí que no tenía nada por qué vivir."),
    ("S", "Noté que me agitaba."),
    ("S", "Se me hizo difícil relajarme."),
    ("D", "Me sentí triste y deprimido(a)."),
    ("S", "No toleré nada que no me permitiera continuar con lo que estaba haciendo."),
    ("A", "Sentí que estaba al punto de pánico."),
    ("D", "No me pude entusiasmar por nada."),
    ("D", "Sentí que valía muy poco como persona."),
    ("S", "Sentí que estaba muy irritable."),
    ("A", "Sentí los latidos de mi corazón a pesar de no haber hecho ningún esfuerzo físico."),
    ("A", "Tuve miedo sin razón."),
    ("D", "Sentí que la vida no tenía ningún sentido."),
]


def _dass_pregunta(i, sub, texto):
    p = {"id": i, "texto": texto, "subescala": sub}
    if i in (10, 21):
        p["riesgo"] = {"tipo": "desesperanza", "etiqueta": "Desesperanza / falta de sentido vital (indicador no validado)", "minimo": 2, "validada": False}
    return p


def _cortes5(n, l, m, s):
    return [
        {"desde": 0, "hasta": n, "codigo": "normal", "etiqueta": "Normal"},
        {"desde": n + 1, "hasta": l, "codigo": "leve", "etiqueta": "Leve"},
        {"desde": l + 1, "hasta": m, "codigo": "moderada", "etiqueta": "Moderada"},
        {"desde": m + 1, "hasta": s, "codigo": "severa", "etiqueta": "Severa"},
        {"desde": s + 1, "hasta": 42, "codigo": "extremadamente-severa", "etiqueta": "Extremadamente severa"},
    ]


DASS21 = {
    "slug": "dass-21",
    "nombre": "DASS-21",
    "nombre_largo": "Escalas de Depresión, Ansiedad y Estrés (DASS-21)",
    "dominio": "Depresión, ansiedad y estrés",
    "duracion_min": 5,
    "mayor_es_mejor": False,
    "max": 42,
    "instrucciones": "Lea cada afirmación y marque cuánto le ha ocurrido durante la semana pasada. No hay respuestas correctas o incorrectas.",
    "opciones": [
        {"valor": 0, "texto": "No me ha ocurrido"},
        {"valor": 1, "texto": "Me ha ocurrido un poco, o durante parte del tiempo"},
        {"valor": 2, "texto": "Me ha ocurrido bastante, o durante una buena parte del tiempo"},
        {"valor": 3, "texto": "Me ha ocurrido mucho, o la mayor parte del tiempo"},
    ],
    "preguntas": [_dass_pregunta(i + 1, s, t) for i, (s, t) in enumerate(_DASS_TEXTOS)],
    "subescalas": [
        {"clave": "D", "nombre": "Depresión", "cortes": _cortes5(9, 13, 20, 27)},
        {"clave": "A", "nombre": "Ansiedad", "cortes": _cortes5(7, 9, 14, 19)},
        {"clave": "S", "nombre": "Estrés", "cortes": _cortes5(14, 18, 25, 33)},
    ],
    "multiplicador": 2,
    "referencia": "Lovibond y Lovibond (1995); validación chilena: Antúnez y Vinet (2012), Terapia Psicológica. Puntajes ×2 (equivalencia DASS-42).",
}

RSES = {
    "slug": "rses",
    "nombre": "Rosenberg",
    "nombre_largo": "Escala de Autoestima de Rosenberg (RSES)",
    "dominio": "Autoestima",
    "duracion_min": 3,
    "mayor_es_mejor": True,
    "max": 40,
    "min": 10,
    "instrucciones": "Indique cuánto está de acuerdo con cada afirmación.",
    "opciones": [
        {"valor": 4, "texto": "Muy de acuerdo"},
        {"valor": 3, "texto": "De acuerdo"},
        {"valor": 2, "texto": "En desacuerdo"},
        {"valor": 1, "texto": "Muy en desacuerdo"},
    ],
    "preguntas": [
        {"id": 1, "texto": "Siento que soy una persona digna de aprecio, al menos en igual medida que los demás."},
        {"id": 2, "texto": "Estoy convencido(a) de que tengo cualidades buenas."},
        {"id": 3, "texto": "Soy capaz de hacer las cosas tan bien como la mayoría de la gente."},
        {"id": 4, "texto": "Tengo una actitud positiva hacia mí mismo(a)."},
        {"id": 5, "texto": "En general estoy satisfecho(a) de mí mismo(a)."},
        {"id": 6, "texto": "Siento que no tengo mucho de lo que estar orgulloso(a).", "inversa": True},
        {"id": 7, "texto": "En general, me inclino a pensar que soy un fracasado(a).", "inversa": True},
        {"id": 8, "texto": "Me gustaría poder sentir más respeto por mí mismo(a).", "inversa": True},
        {"id": 9, "texto": "Hay veces que realmente pienso que soy un inútil.", "inversa": True},
        {"id": 10, "texto": "A veces creo que no soy buena persona.", "inversa": True},
    ],
    "cortes": [
        {"desde": 10, "hasta": 25, "codigo": "baja", "etiqueta": "Autoestima baja"},
        {"desde": 26, "hasta": 29, "codigo": "media", "etiqueta": "Autoestima media"},
        {"desde": 30, "hasta": 40, "codigo": "elevada", "etiqueta": "Autoestima elevada"},
    ],
    "referencia": "Rosenberg (1965); validación chilena: Rojas-Barahona, Zegers y Förster (2009), Rev Méd Chile. El ítem 8 tiene comportamiento psicométrico discutido en versiones en español.",
}

ESCALAS = {e["slug"]: e for e in (PHQ9, GAD7, DASS21, RSES)}


def get_escala(slug):
    return ESCALAS.get(slug)


def catalogo_publico(escala):
    """Datos necesarios para responder (sin cortes ni referencia)."""
    datos = {k: escala[k] for k in ("slug", "instrucciones", "opciones", "duracion_min")}
    datos["preguntas"] = [{"id": p["id"], "texto": p["texto"]} for p in escala["preguntas"]]
    datos["pregunta_funcional"] = escala.get("pregunta_funcional")
    return datos


def _banda(cortes, puntaje):
    for c in cortes:
        if c["desde"] <= puntaje <= c["hasta"]:
            return c
    return cortes[-1] if puntaje > cortes[-1]["hasta"] else cortes[0]


def calcular_escala(escala, respuestas):
    """Valida y puntúa. `respuestas` = {id_pregunta: valor}. Lanza ValueError si hay errores."""
    if not isinstance(respuestas, dict):
        raise ValueError("Las respuestas deben enviarse como objeto.")
    valores_validos = {o["valor"] for o in escala["opciones"]}
    opcion_texto = {o["valor"]: o["texto"] for o in escala["opciones"]}
    norm = {}
    for p in escala["preguntas"]:
        raw = respuestas.get(str(p["id"]), respuestas.get(p["id"]))
        try:
            val = int(raw)
        except (TypeError, ValueError):
            raise ValueError(f"Falta responder la pregunta {p['id']}.")
        if val not in valores_validos:
            raise ValueError(f"Valor no válido en la pregunta {p['id']}.")
        norm[str(p["id"])] = val

    funcional = None
    pf = escala.get("pregunta_funcional")
    if pf:
        raw = respuestas.get(str(pf["id"]), respuestas.get(pf["id"]))
        if raw not in (None, ""):
            try:
                v = int(raw)
            except (TypeError, ValueError):
                raise ValueError("Valor no válido en la pregunta de funcionamiento.")
            opts = {o["valor"]: o["texto"] for o in pf["opciones"]}
            if v not in opts:
                raise ValueError("Valor no válido en la pregunta de funcionamiento.")
            norm[str(pf["id"])] = v
            funcional = opts[v]

    alertas = []
    for p in escala["preguntas"]:
        r = p.get("riesgo")
        val = norm[str(p["id"])]
        if r and val >= r["minimo"]:
            alertas.append({
                "pregunta_id": p["id"], "texto": p["texto"], "valor": val,
                "opcion": opcion_texto.get(val, str(val)), "tipo": r["tipo"],
                "etiqueta": r["etiqueta"], "validada": r["validada"],
            })

    resultado = {"total": None, "severidad": "", "etiqueta": "", "subescalas": [], "alertas_riesgo": alertas, "item_funcional": funcional}
    if escala.get("subescalas"):
        mult = escala.get("multiplicador", 1)
        for sub in escala["subescalas"]:
            puntaje = sum(norm[str(p["id"])] for p in escala["preguntas"] if p.get("subescala") == sub["clave"]) * mult
            b = _banda(sub["cortes"], puntaje)
            resultado["subescalas"].append({"clave": sub["clave"], "nombre": sub["nombre"], "puntaje": puntaje, "severidad": b["codigo"], "etiqueta": b["etiqueta"]})
        peor = max(resultado["subescalas"], key=lambda s: [c["codigo"] for c in escala["subescalas"][0]["cortes"]].index(s["severidad"]))
        resultado["severidad"] = peor["severidad"]
        resultado["etiqueta"] = f"Mayor severidad: {peor['nombre']} {peor['etiqueta'].lower()}"
    else:
        total = 0
        for p in escala["preguntas"]:
            v = norm[str(p["id"])]
            total += (5 - v) if p.get("inversa") else v
        b = _banda(escala["cortes"], total)
        resultado.update(total=total, severidad=b["codigo"], etiqueta=b["etiqueta"])
    return norm, resultado
