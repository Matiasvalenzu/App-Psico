# Funcionalidades y flujos del producto

## Vista general de modulos

Psiconex esta dividido en estos modulos principales:

| Modulo | Para que sirve |
|---|---|
| Autenticacion | Acceso seguro de psicologos y administracion basica de usuarios |
| Pacientes | Ficha clinica y administrativa de cada paciente |
| Sesiones | Registro de sesiones presenciales, virtuales, documentos y tests |
| Audio + transcripcion | Grabacion, subida, procesamiento, diarizacion y texto por hablante |
| Voz | Perfil de voz del psicologo para identificarlo automaticamente |
| Documentos | Carga de PDF, DOCX o TXT como contexto del paciente |
| Chat IA | Preguntas al historial del paciente con contexto recuperado por embeddings |
| Informes IA | Guardado de respuestas IA como informes persistentes exportables |
| Tests | Envio, respuesta publica, correccion y observacion IA de tests psicologicos |
| Agenda | Calendario de citas, recurrencia, prospectos, confirmacion y Google Calendar |
| Extension Chrome | Captura de subtitulos de Meet/Zoom para sesiones remotas |
| Exportaciones | PDF y Word de sesiones, documentos, tests e informes |

## 1. Autenticacion y usuarios

### Que hace

- Login con usuario y contrasena.
- Tokens JWT con access token y refresh token.
- Renovacion automatica del token si expira.
- Redireccion al login si la sesion no es valida.
- Usuario `Admin` puede crear otros usuarios.

### Valor para marketing

El acceso esta pensado para profesionales y equipos pequenos. Cada psicologo ve sus propios pacientes, sesiones, conversaciones, informes, evaluaciones y citas.

### Limite actual

La administracion de roles es basica. Hoy el privilegio de crear usuarios depende de `username === "Admin"` o `is_admin === true` expuesto por backend.

## 2. Gestion de pacientes

### Que hace

Permite crear, buscar, listar y editar pacientes. Cada paciente pertenece a un psicologo.

### Campos actuales de la ficha

- Nombre y apellido.
- Fecha de nacimiento.
- RUT.
- Edad.
- Sexo.
- Ocupacion laboral.
- Motivo de consulta.
- Telefono WhatsApp.
- Email de contacto.
- Nacionalidad.
- Religion.
- Direccion.
- Comuna.
- Prevision.
- Indicador de menor de edad.
- Nombre y telefono de tutor.
- Contacto de emergencia.
- Origen de consulta.
- Derivacion o interconsulta.
- Diagnostico sospechado.
- Medicacion actual.
- Riesgo suicida.
- Nivel de ideacion suicida.
- Frecuencia de atencion.
- Objetivos de intervencion.
- Notas privadas.
- Estado activo.

### Problema que soluciona

Evita que el psicologo tenga datos clinicos, administrativos y de contacto dispersos en cuadernos, planillas, WhatsApp o documentos sueltos.

### Valor para marketing

La ficha no es solo una libreta digital. Es el centro del historial del paciente y alimenta el contexto de IA para preguntas, informes y tests.

## 3. Sesiones clinicas

### Tipos de sesion actuales

| Tipo | Descripcion |
|---|---|
| `AUDIO` | Sesion presencial grabada desde el navegador |
| `VIRTUAL` | Sesion online capturada desde subtitulos de Meet/Zoom |
| `DOCUMENTO_EXTERNO` | Archivo cargado como contexto del paciente |
| `TEST_PSICOLOGICO` | Resultado de test digitalizado |

### Estados actuales

- Pendiente.
- Procesando.
- Completado.
- Error.

### Numero correlativo

Las sesiones no documentales reciben `numero_sesion` automatico por paciente. Esto permite mostrar `Sesion 1`, `Sesion 2`, etc., y evita que el profesional tenga que contar manualmente.

### Problema que soluciona

El psicologo puede revisar rapidamente el historial y no perder continuidad del proceso.

## 4. Grabacion presencial y transcripcion

### Flujo del psicologo

1. Entra a la ficha de paciente.
2. Crea una nueva sesion.
3. Abre la sesion.
4. Presiona grabar.
5. El navegador pide acceso al microfono.
6. Al terminar, se sube el audio.
7. El backend procesa en segundo plano.
8. La sesion cambia de `PROCESANDO` a `COMPLETADO`.
9. Se muestra la transcripcion por segmentos.
10. El psicologo puede editar texto, hablante y notas.

### Pipeline tecnico funcional

- Captura de audio con `MediaRecorder` en el navegador.
- Subida del archivo al backend.
- Almacenamiento local por paciente en volumen de audio.
- Celery procesa el audio sin bloquear la interfaz.
- Whisper transcribe en espanol.
- PyannoteAI separa turnos de hablantes si esta configurado.
- ECAPA compara la voz contra el perfil del psicologo.
- Se asigna cada segmento como `PSICOLOGO` o `PACIENTE`.
- Se generan embeddings de texto.
- Se guarda todo como `TranscripcionSegmento`.

### Valor para marketing

La promesa no debe ser que elimina completamente el trabajo clinico. La promesa correcta es que entrega una base transcrita, ordenada y editable, reduciendo trabajo manual.

## 5. Perfil de voz del psicologo

### Que hace

El psicologo graba entre 3 y 5 muestras de voz. El backend extrae embeddings con modelo ECAPA y guarda un perfil asociado al usuario.

### Para que sirve

Cuando se procesa una sesion, el sistema compara los hablantes detectados contra el perfil de voz del psicologo. Esto permite identificar cual voz corresponde al profesional y cual al paciente.

### Datos guardados

- Vector de embedding.
- Modelo utilizado.
- Dimension del vector.
- Cantidad de muestras.
- Duracion total de muestras.
- Estado activo.

### Valor diferencial

Muchos transcriptores separan voces como `Speaker 1` y `Speaker 2`. Psiconex apunta a entregar `Psicologo` y `Paciente`, que es mucho mas util en contexto clinico.

## 6. Edicion manual de transcripciones

### Que hace

La vista de sesion permite editar la transcripcion completa conservando una estructura por intervenciones. Cada linea debe comenzar con `Psicologo:`, `Paciente:` o `Documento:`.

### Para que sirve

Permite corregir errores inevitables de transcripcion, ajustar atribucion de hablante y dejar un registro clinico revisado por el profesional.

### Valor para marketing

La IA propone, el psicologo decide. Este es un mensaje importante porque reduce resistencia etica ante herramientas de IA.

## 7. Sesiones virtuales Meet/Zoom

### Que hace realmente

La aplicacion permite crear una sesion virtual asociada a un paciente y una plataforma: Google Meet o Zoom. La extension Chrome captura subtitulos/captions visibles en la reunion y los envia al backend.

### Flujo

1. Psicologo crea una sesion remota en la ficha del paciente.
2. Selecciona Google Meet o Zoom.
3. Opcionalmente ingresa URL y fecha.
4. Se guarda el ID de sesion en el navegador.
5. La extension Chrome lee subtitulos de Meet/Zoom.
6. Envia fragments de texto al backend con nombre del hablante y timestamp.
7. Al finalizar, el psicologo indica que nombre corresponde al psicologo y al paciente.
8. El backend consolida captions y genera segmentos con embeddings.

### Importante para marketing

La implementacion actual captura subtitulos, no graba audio/video de la videollamada. Por lo tanto, el claim correcto es:

> Registra sesiones online a partir de subtitulos de Meet/Zoom.

Evitar afirmar sin desarrollo adicional:

> Graba la videollamada completa.

## 8. Documentos externos

### Que hace

Permite cargar documentos del paciente en formatos:

- `.txt`
- `.docx`
- `.pdf`

El backend extrae el texto, lo normaliza, lo divide en segmentos, genera embeddings y lo guarda como una sesion tipo `DOCUMENTO_EXTERNO`.

### Ejemplos de uso

- Informes antiguos.
- Derivaciones.
- Evaluaciones externas.
- Documentos enviados por otro profesional.
- Historial clinico previo.

### Valor para marketing

Psiconex no solo transcribe sesiones nuevas. Tambien permite incorporar contexto historico escrito para que el chat IA pueda responder considerando documentos relevantes.

## 9. Chat IA por paciente

### Que hace

Permite crear conversaciones por paciente y preguntarle a la IA sobre el historial registrado.

### Como funciona

1. El psicologo escribe una pregunta.
2. El backend genera embedding de la pregunta.
3. Busca segmentos relevantes del paciente con pgvector y distancia coseno.
4. Diversifica resultados para incluir distintas sesiones.
5. Agrega contexto de ficha clinica del paciente.
6. Envia contexto y pregunta a DeepSeek.
7. Guarda mensaje del psicologo y respuesta del asistente.
8. Guarda fuentes asociadas a la respuesta.

### Ejemplos de preguntas utiles

- Que temas se repiten en las ultimas sesiones?
- Que dijo el paciente sobre su relacion familiar?
- Prepara una proxima sesion con focos de intervencion.
- Resume el proceso terapeutico hasta ahora.
- Detecta alertas o riesgos mencionados en sesiones anteriores.

### Limites clinicos

El prompt interno indica que la IA debe actuar como apoyo, diferenciar evidencia de inferencias y no entregar diagnosticos definitivos.

## 10. Informes IA persistentes

### Que hace

Una respuesta util del chat puede guardarse como informe IA asociado al paciente.

Tipos actuales:

- Resumen clinico.
- Evolucion.
- Proxima sesion.
- Otro.

### Exportaciones

Los informes pueden descargarse en:

- PDF.
- Word/DOCX.

### Valor para marketing

El producto no solo conversa con IA. Permite convertir una respuesta en un documento reutilizable, descargable y archivado en la ficha del paciente.

## 11. Tests psicologicos

### Que esta implementado

Actualmente existe el Test de Creencias Ellis.

Datos del test:

- 100 preguntas.
- Respuestas: `De acuerdo` o `No estoy de acuerdo`.
- 10 dimensiones.
- Puntajes por dimension.
- Niveles: bajo, moderado o alto.
- Enlace publico por token.
- Expiracion configurable por dias.
- Respuesta sin login del paciente.
- Resultado guardado en ficha como sesion tipo `TEST_PSICOLOGICO`.
- Observacion IA generada con DeepSeek si esta configurado.

### Flujo

1. Psicologo abre ficha del paciente.
2. Envia Test de Creencias Ellis.
3. El sistema genera enlace publico.
4. Si SMTP esta configurado, envia email; si no, entrega enlace manual.
5. Paciente responde desde una pagina publica.
6. El sistema valida que todas las preguntas esten respondidas.
7. Calcula puntajes.
8. Genera interpretacion.
9. Crea una sesion de tipo test.
10. Segmenta resultados para que entren en la memoria semantica del paciente.
11. Puede generar observacion IA con marco DSM-5 de apoyo si el documento esta disponible.

### Valor para marketing

Los tests dejan de consumir tiempo terapeutico de sesion. El paciente responde fuera de la consulta y el psicologo recibe resultados ordenados.

### Limite actual

La landing actual menciona otros tests como PHQ-9, GAD-7, BAI/BDI, pero el codigo revisado solo muestra implementado el Test de Creencias Ellis.

## 12. Agenda clinica

### Que hace

Permite gestionar citas de pacientes existentes o prospectos.

Funciones actuales:

- Calendario visual con FullCalendar.
- Citas programadas, confirmacion solicitada, confirmadas y anuladas.
- Citas para pacientes existentes.
- Citas para prospectos sin ficha aun.
- Creacion de paciente desde cita de prospecto.
- Recurrencia semanal o quincenal.
- Validacion de cruces de horario.
- Arrastrar y mover citas.
- Solicitar confirmacion por mensaje de WhatsApp prellenado.
- Sincronizacion bidireccional con Google Calendar si OAuth esta configurado.

### Valor para marketing

La agenda conecta captacion, atencion y ficha clinica. Un prospecto puede convertirse en paciente sin duplicar datos.

## 13. Google Calendar

### Que hace

- Conecta cuenta Google via OAuth.
- Crea o reutiliza un calendario dedicado.
- Sincroniza citas de Psiconex hacia Google.
- Importa o actualiza eventos de Google en Psiconex.
- Marca anulaciones.
- Tiene ventana de sincronizacion de 30 dias hacia atras y 365 dias hacia adelante.

### Dependencia

Requiere credenciales Google configuradas.

## 14. Exportaciones

### Que puede exportarse

- Sesiones clinicas a PDF y DOCX.
- Documentos externos extraidos a PDF y DOCX.
- Resultados de tests completos a PDF y DOCX.
- Secciones especificas de test: respuestas, puntajes, interpretacion, observacion IA.
- Informes IA a PDF y DOCX.

### Valor para marketing

El psicologo puede usar Psiconex como lugar de trabajo y tambien sacar documentos para compartir, archivar o complementar su flujo actual.

## 15. Experiencia visual y navegacion

La aplicacion tiene:

- Login con marca Psiconex.
- Layout con navegacion superior.
- Modulos: Pacientes, Voz, Agenda, Tests y Crear Usuario para Admin.
- Modo claro/oscuro.
- UI responsive basada en Next.js, Tailwind y componentes propios.
- Iconografia con `lucide-react`.

## Flujo completo ideal del psicologo

1. Crea cuenta o recibe usuario.
2. Ingresa a Psiconex.
3. Crea paciente o transforma prospecto desde agenda.
4. Completa ficha clinica.
5. Configura perfil de voz una vez.
6. Agenda citas y sincroniza Google Calendar.
7. Graba sesion presencial o crea sesion virtual.
8. Revisa transcripcion.
9. Corrige si es necesario.
10. Agrega notas clinicas.
11. Envia test si corresponde.
12. Usa chat IA para preparar proxima sesion o resumir proceso.
13. Guarda respuesta como informe IA.
14. Exporta PDF o Word cuando lo necesite.

## Mensaje funcional resumido

Psiconex cubre el ciclo completo de atencion: agenda, ficha, sesion, transcripcion, documentos, tests, memoria clinica, informes y exportacion.
