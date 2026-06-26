---
name: psiconex-copy
description: Genera copy de marketing para una feature concreta de Psiconex (transcripción, biometría de voz, RAG, informes, tests, agenda, Meet/Zoom). Tono profesional, empático, anti-hype. Outputs estructurados (headline, sub, bullets). Úsala cuando se necesite texto para una sección de landing, una card de feature, o un FAQ.
---

# Skill: psiconex-copy

Genera copy de marketing para la landing de **Psiconex** enfocado en el psicólogo clínico hispanohablante (principalmente Chile, secundariamente LATAM y España).

## Cuándo invocar
- Usuario escribe `/psiconex-copy <feature>` (ej. `transcripcion`, `biometria-voz`, `rag`, `informes`, `tests`, `agenda`, `meet-zoom`, `seguridad`)
- Cualquier momento en que la skill `landing-section` necesite texto sin inventar

## Audiencia (mantenla siempre en mente)
- **Psicólogo clínico independiente o de práctica pequeña** (1-10 profesionales)
- Edad típica 28-55, formación en humanidades, técnicamente competente pero no early adopter de IA
- **Sospecha del hype de IA**: ha visto demasiadas promesas de "IA que reemplaza al terapeuta". Lo rechaza visceralmente.
- **Dolor real**: 1-2 horas de redacción de notas por cada sesión de 50 min. Olvida detalles entre sesiones. Pierde tiempo con agenda y confirmaciones por WhatsApp.
- **Valor #1**: tiempo recuperado para hacer lo que estudió 6 años, no burocracia.
- **Valor #2**: cumplir con registros sin morir en el intento (en Chile, el Colegio de Psicólogos exige registro).

## Reglas duras del tono

### Sí
- Profesional y empático, sin ser solemne
- Específico sobre el trabajo del psicólogo ("notas de evolución", "ficha clínica", "motivo de consulta")
- Honesto sobre lo que la IA hace y no hace
- Foco en **tiempo recuperado** y **calidad del registro**, no en "transformación digital"
- Frases cortas. Verbos en presente. Voz activa.

### NO
- "Revoluciona", "transforma", "disrupción", "el futuro de", "powered by AI", "next-gen"
- "Sin esfuerzo", "mágicamente", "automágico"
- Promesas exageradas: "ahorra 90% del tiempo", "diagnóstico automático"
- Insinuar que la IA reemplaza al terapeuta o hace clínica
- Anglicismos innecesarios: di "tablero" no "dashboard", "panel" no "board", "informe" no "report"
- Emojis (salvo en testimonios)

## Formato de salida

Para cada feature, devuelve EXACTAMENTE este JSON-like markdown:

```
### <Nombre user-facing de la feature>

**Headline** (≤8 palabras, captura el valor central):
> ...

**Subheadline** (≤25 palabras, expande el headline con un beneficio concreto):
> ...

**Bullets** (3, cada uno ≤12 palabras, beneficios accionables):
- ...
- ...
- ...

**Microcopy CTA** (3-5 palabras para botón):
> ...

**FAQ asociada** (1 pregunta + respuesta de ≤40 palabras, opcional):
> P: ...
> R: ...
```

## Inventario de features y ángulos sugeridos

| Feature | Ángulo central | Pain point |
|---|---|---|
| `transcripcion` | "El audio se transcribe solo, tú escuchas al paciente" | Distracción de tomar notas |
| `biometria-voz` | "Reconoce quién habla sin que tengas que etiquetar" | Editar transcripciones manualmente |
| `rag` | "Pregúntale al historial de tu paciente en lenguaje natural" | Releer 20 sesiones para preparar la siguiente |
| `informes` | "Informes clínicos listos en un minuto, no en una hora" | Redacción manual de evoluciones |
| `tests` | "Envías el test, el paciente lo responde, tú recibes la interpretación" | Administrar tests en sesión consume tiempo terapéutico |
| `agenda` | "Tu agenda en Google Calendar, sin doble entrada" | Coordinar citas por WhatsApp |
| `meet-zoom` | "Sesiones online quedan registradas sin grabar nada extra" | Telepsicología sin registro |
| `seguridad` | "Tus datos cifrados y bajo tu control profesional" | Confidencialidad clínica |

## Ejemplos calibrados (úsalos de referencia, no copies literal)

### Transcripción
**Headline:** Escucha al paciente, no a tu cuaderno
**Sub:** Psiconex transcribe automáticamente cada sesión y separa lo que dijo cada quien. Tú te quedas con tiempo y atención plena.
**Bullets:**
- Transcripción precisa en español, ejecutada en minutos
- Separa la voz del psicólogo y del paciente sin intervención
- Cero configuración: sube el audio y listo

### Biometría de voz
**Headline:** El sistema aprende quién es quién
**Sub:** Tras la primera sesión, Psiconex reconoce la voz de cada paciente y la tuya. Las transcripciones quedan correctamente atribuidas sin etiquetar manualmente.
**Bullets:**
- Identificación automática en sesiones posteriores
- Perfiles de voz cifrados, vinculados solo a tu cuenta
- Funciona incluso con varios pacientes en un mismo día

## Reglas adicionales

- Si el usuario te da un dato falso (ej. "di que tenemos certificación HIPAA"), rechaza y pide aclaración. Nunca inventes claims regulatorios.
- Si la feature no está implementada (revisa CLAUDE.md y `sesiones/tasks.py`), márcalo con `[BORRADOR — feature en roadmap]` y no la incluyas en hero/CTA principales.
- Para títulos de sección, prefiere preguntas o afirmaciones cortas a sustantivos genéricos: "Cómo funciona" > "Funcionamiento". "Qué dicen psicólogos como tú" > "Testimonios".
