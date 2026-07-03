# Briefing ejecutivo del producto

## Que es Psiconex

Psiconex es una aplicacion web para psicologos clinicos que centraliza el registro de pacientes, sesiones, transcripciones, documentos, tests psicologicos, agenda e informes apoyados por IA.

El objetivo del producto no es reemplazar al psicologo ni tomar decisiones clinicas. Su objetivo es reducir carga administrativa, mejorar la calidad del registro clinico y permitir que el profesional prepare mejor sus sesiones usando informacion organizada.

## Descripcion en una frase

Psiconex convierte sesiones, documentos y tests psicologicos en una ficha clinica organizada, buscable y lista para generar informes con apoyo de IA.

## Elevator pitch

Los psicologos pierden horas registrando sesiones, reconstruyendo informes y buscando detalles en notas dispersas. Psiconex automatiza la transcripcion, separa la voz del psicologo y del paciente, ordena el historial por paciente, permite hacer preguntas al expediente clinico y genera informes editables. El profesional mantiene siempre el criterio clinico; la IA ayuda a ordenar, resumir y recuperar informacion.

## Usuario objetivo

Psicologos clinicos independientes o equipos pequenos de atencion psicologica.

Caracteristicas probables:

- Atienden pacientes de forma presencial y online.
- Registran notas clinicas, fichas, evolucion y antecedentes.
- Pierden tiempo redactando despues de cada sesion.
- Necesitan preparar informes, derivaciones o resumenes del proceso.
- Usan Google Calendar, WhatsApp, correo y videollamadas.
- Tienen sensibilidad alta respecto a confidencialidad, consentimiento y uso etico de IA.
- Desconfian de herramientas que prometen diagnosticar automaticamente o reemplazar al terapeuta.

## Problema principal

El psicologo hace mucho trabajo administrativo fuera de la sesion:

- Escribir notas de evolucion.
- Ordenar fichas clinicas.
- Recordar detalles de sesiones anteriores.
- Preparar informes.
- Revisar documentos externos.
- Aplicar y corregir tests.
- Coordinar agenda y confirmar asistencia.
- Registrar sesiones online.

Ese trabajo reduce tiempo disponible, aumenta desgaste y puede afectar la continuidad del proceso terapeutico si la informacion queda incompleta o dispersa.

## Solucion propuesta

Psiconex integra en una sola plataforma:

- Ficha del paciente con datos clinicos y administrativos.
- Grabacion de sesiones presenciales desde el navegador.
- Transcripcion automatica en espanol.
- Diarizacion: separacion de hablantes.
- Perfil de voz del psicologo con ECAPA para reconocer quien habla.
- Captura de subtitulos de sesiones remotas en Google Meet y Zoom mediante extension Chrome.
- Carga de documentos externos PDF, DOCX y TXT como contexto del paciente.
- Tests psicologicos digitales con enlace publico para el paciente.
- Correccion automatica del Test de Creencias Ellis.
- Observacion clinica generada por IA sobre resultados de test.
- Chat IA por paciente con recuperacion semantica del historial.
- Informes IA persistentes, descargables y editables.
- Agenda interna con citas, recurrencia, prospectos, confirmacion por WhatsApp y sincronizacion con Google Calendar.
- Exportacion a PDF y Word.

## Beneficio central

Psiconex ayuda al psicologo a recuperar tiempo y tener mejor continuidad clinica sin delegar su criterio profesional en la IA.

## Beneficios especificos

- Menos horas redactando notas despues de atender.
- Mejor foco durante la sesion, porque no necesita escribir todo manualmente.
- Historial del paciente mas completo y consultable.
- Preparacion mas rapida de la proxima sesion.
- Informes clinicos y resumenes con estructura inicial lista para revisar.
- Tests aplicados fuera de la sesion y guardados automaticamente.
- Menos dispersion entre audio, documentos, calendario y notas.
- Registro mas ordenado para continuidad terapeutica, derivaciones o auditoria interna.

## Posicionamiento recomendado

Psiconex debe comunicarse como un asistente clinico-administrativo para psicologos, no como una IA que diagnostica.

Posicionamiento sugerido:

> La plataforma que convierte tus sesiones y documentos en registros clinicos utiles, buscables y listos para trabajar.

Alternativas:

> Menos tiempo redactando. Mas tiempo haciendo clinica.

> Tu memoria clinica organizada con IA, siempre bajo tu criterio profesional.

> Escucha al paciente, no a tu cuaderno.

## Lo que ya esta construido

La aplicacion actual incluye una base funcional amplia:

| Area | Estado |
|---|---|
| Login con JWT | Implementado |
| Usuarios administrados por usuario `Admin` | Implementado |
| Registro y busqueda de pacientes | Implementado |
| Ficha clinica ampliada | Implementado |
| Sesiones con numero correlativo por paciente | Implementado |
| Grabacion de audio presencial | Implementado |
| Procesamiento asincrono con Celery | Implementado |
| Transcripcion con Whisper | Implementado |
| Diarizacion con PyannoteAI API | Implementado si existe API key |
| Perfil de voz del psicologo con ECAPA | Implementado |
| Identificacion psicologo/paciente | Implementado |
| Edicion manual de transcripcion | Implementado |
| Carga de documentos externos | Implementado |
| Sesiones virtuales Meet/Zoom por captions | Implementado con extension Chrome |
| Chat IA por paciente con RAG | Implementado si existe API key DeepSeek |
| Informes IA persistentes | Implementado |
| Exportacion PDF y Word | Implementado |
| Test de Creencias Ellis | Implementado |
| Enlace publico para responder tests | Implementado |
| Observacion IA sobre test | Implementado si existe API key DeepSeek |
| Agenda con recurrencia | Implementado |
| Confirmacion por WhatsApp prellenada | Implementado |
| Google Calendar OAuth y sincronizacion | Implementado si existen credenciales Google |
| Landing de marketing | Implementada en carpeta `marketing/` |

## Lo que depende de configuracion externa

Estas funciones existen en codigo, pero requieren credenciales o infraestructura:

- DeepSeek: requiere `DEEPSEEK_API_KEY`.
- PyannoteAI: requiere `PYANNOTE_AUTH_TOKEN`.
- Google Calendar: requiere `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
- Envio de emails para tests: requiere SMTP configurado.
- DSM-5 como contexto de apoyo: requiere archivo local disponible en `DSM5_DOCUMENT_PATH`.
- Embeddings con modelo real SentenceTransformers: requiere `EMBEDDING_USE_MODEL=True`; si no, usa embeddings deterministas internos.

## Lo que no se debe prometer como implementado

No afirmar como disponible sin desarrollo o validacion adicional:

- Consentimiento informado digital completo.
- Firma electronica de consentimiento.
- Pagos, tarifas, deuda, boletas o facturacion.
- Analitica de negocio avanzada.
- App movil nativa.
- Auditoria formal de accesos.
- Cifrado de extremo a extremo.
- Certificacion HIPAA, GDPR o cumplimiento legal auditado.
- Hosting en Chile garantizado, salvo que la infraestructura real lo confirme.
- Recordatorios automaticos multicanal a pacientes, salvo mensajes prellenados y sincronizacion calendario.
- Diagnostico automatico.

## Tono recomendado

El tono debe ser profesional, empatico y sobrio.

Usar:

- Tiempo recuperado.
- Registro clinico mas ordenado.
- Apoyo al criterio profesional.
- Informacion del paciente en un solo lugar.
- IA como asistente, no como reemplazo.

Evitar:

- Revoluciona la psicologia.
- Diagnostica automaticamente.
- Reemplaza la toma de notas por completo.
- Cumple cualquier normativa sin evidencia.
- Datos 100% seguros.
- Ahorra 90% del tiempo sin medicion real.

## Mensaje comercial base

> Psiconex ayuda a psicologos clinicos a registrar, consultar y preparar mejor sus sesiones. Transcribe audios, ordena documentos, aplica tests, permite preguntar al historial del paciente y genera informes editables con IA. Todo queda bajo control del profesional.
