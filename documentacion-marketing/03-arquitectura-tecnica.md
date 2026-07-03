# Arquitectura tecnica y construccion del proyecto

## Resumen tecnico

La solucion esta construida como una aplicacion web con backend Django, frontend Next.js, base PostgreSQL con pgvector, procesamiento asincrono con Celery/Redis, modelos de audio/voz y servicios externos de IA.

## Stack principal

| Capa | Tecnologia |
|---|---|
| Backend | Django 5, Django REST Framework |
| Auth | Simple JWT |
| Frontend app | Next.js 14, React 18, TypeScript, Tailwind |
| Landing marketing | Next.js 16, React 19, Tailwind 4 |
| Base de datos | PostgreSQL 15 con pgvector |
| Cola | Redis 7 + Celery |
| Audio/transcripcion | faster-whisper |
| Diarizacion | PyannoteAI API |
| Biometria de voz | SpeechBrain ECAPA-TDNN |
| Embeddings texto | SentenceTransformers opcional o embedding deterministico interno |
| IA conversacional | DeepSeek API |
| Documentos | pypdf, python-docx |
| Exportacion | reportlab para PDF, python-docx para Word |
| Agenda | FullCalendar en frontend + Google Calendar API |
| Extension | Chrome Extension Manifest V3 |
| Orquestacion local | Docker Compose |

## Estructura relevante del repositorio

```text
Herramienta-Psicologo/
  backend/
    config/              Settings, URLs, Celery, auth helpers
    pacientes/           Ficha y CRUD de pacientes
    sesiones/            Sesiones, transcripcion, documentos, audio, exportacion
    voz/                 Perfil de voz ECAPA
    chat/                Conversaciones, RAG e informes IA
    evaluaciones/        Tests psicologicos, enlaces publicos y resultados
    agenda/              Citas, prospectos y Google Calendar
  frontend/
    src/app/login/       Login
    src/app/dashboard/   App privada del psicologo
    src/app/tests/       Vista publica para responder tests
    src/lib/api.ts       Cliente HTTP con JWT
  marketing/
    src/app/             Landing actual de Psiconex
    src/components/      Secciones de hero, problema, features, pricing, FAQ
  chrome-extension/
    manifest.json        Extension para Meet/Zoom
    src/                 Captura captions y envia al backend
  docker-compose.yml     Servicios db, redis, backend, celery, frontend
```

## Servicios Docker

`docker-compose.yml` levanta:

| Servicio | Rol |
|---|---|
| `db` | PostgreSQL con pgvector |
| `redis` | Broker y backend de resultados Celery |
| `backend` | API Django en puerto 8000 |
| `celery` | Worker de procesamiento de audio e IA asincrona |
| `frontend` | App Next.js en puerto 3000 |

Volumenes principales:

- `postgres_data`: datos de PostgreSQL.
- `audio_data`: audios subidos.
- `model_cache`: cache de modelos.

## Variables de entorno importantes

No incluir valores secretos en documentacion comercial. Solo nombrar las capacidades:

| Variable | Uso |
|---|---|
| `DJANGO_SECRET_KEY` | Firma y seguridad de Django |
| `POSTGRES_*` | Conexion a base de datos |
| `REDIS_URL` | Cola Celery |
| `DEEPSEEK_API_KEY` | Chat IA e informes |
| `DEEPSEEK_BASE_URL` | Endpoint de DeepSeek |
| `PUBLIC_APP_URL` | URL publica para links de tests |
| `TEST_LINK_EXPIRATION_DAYS` | Vencimiento de enlaces de test |
| `DSM5_DOCUMENT_PATH` | PDF DSM-5 local para contexto de tests |
| `EMAIL_*` | Envio SMTP de tests |
| `GOOGLE_CLIENT_ID` | OAuth Google Calendar |
| `GOOGLE_CLIENT_SECRET` | OAuth Google Calendar |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Callback OAuth |
| `GOOGLE_CALENDAR_NAME` | Nombre del calendario dedicado |
| `AUDIO_STORAGE_PATH` | Ruta de audios |
| `WHISPER_MODEL` | Modelo Whisper |
| `WHISPER_DEVICE` | CPU/GPU |
| `WHISPER_COMPUTE_TYPE` | Tipo de computo |
| `PYANNOTE_AUTH_TOKEN` | Diarizacion PyannoteAI |
| `PYANNOTE_API_MODEL` | Modelo de diarizacion |
| `SPEAKER_EMBEDDING_MODEL` | Modelo ECAPA |
| `SPEAKER_MATCH_THRESHOLD` | Umbral de match de voz |
| `SPEAKER_MATCH_MARGIN` | Margen de confianza |
| `EMBEDDING_MODEL` | Modelo de embeddings de texto |
| `EMBEDDING_USE_MODEL` | Activar SentenceTransformers real |

## Modelo de datos principal

### Paciente

Representa la ficha clinica y administrativa. Pertenece a un psicologo.

Campos clave:

- Identidad: nombre, apellido, RUT, fecha nacimiento, edad, sexo.
- Contacto: WhatsApp, email, direccion, comuna.
- Contexto: nacionalidad, religion, ocupacion, prevision.
- Clinico: motivo, diagnostico sospechado, medicacion, objetivos, notas.
- Riesgo: riesgo suicida, nivel de ideacion, contacto emergencia.
- Menores: tutor y telefono tutor.
- Origen: origen de consulta, derivacion/interconsulta.

### Sesion

Representa cualquier evento asociado al historial del paciente:

- Sesion grabada.
- Sesion virtual.
- Documento externo.
- Test psicologico.

Campos clave:

- Paciente.
- Psicologo.
- Numero correlativo.
- Fecha/hora.
- Duracion.
- Ruta de audio.
- Origen.
- Nombre de documento.
- Estado.
- Notas del psicologo.
- Plataforma virtual.
- URL de reunion.
- Buffer temporal de captions.

### TranscripcionSegmento

Fragmento de texto indexado.

Campos clave:

- Sesion.
- Orden.
- Inicio y fin en segundos.
- Hablante: psicologo, paciente o documento.
- Etiqueta original de speaker.
- Score de match de voz.
- Texto actual.
- Texto original.
- Embedding vectorial de 1024 dimensiones.

### VoiceProfile

Perfil de voz por usuario:

- Embedding vectorial.
- Modelo usado.
- Dimension.
- Cantidad de muestras.
- Duracion total.
- Estado activo.

### ChatConversacion y ChatMensaje

Conversaciones IA por paciente:

- Paciente.
- Psicologo.
- Titulo.
- Mensajes user/assistant.
- Fuentes JSON asociadas a respuestas.

### InformeIA

Documento generado desde una respuesta IA o creado manualmente:

- Paciente.
- Psicologo.
- Sesion opcional.
- Mensaje origen opcional.
- Tipo.
- Titulo.
- Contenido.
- Fuentes.

### EvaluacionAsignada y ResultadoEvaluacion

Asignacion de test y resultado:

- Paciente.
- Psicologo.
- Sesion asociada.
- Test slug.
- Token hash.
- Enlace generado.
- Email destino.
- Estado.
- Fecha de expiracion.
- Respuestas.
- Puntajes.
- Interpretacion.
- Observacion IA.

### AgendaCita

Cita clinica o prospecto:

- Psicologo.
- Paciente opcional.
- Datos de prospecto.
- Inicio/fin.
- Estado.
- Notas.
- Recurrencia.
- Grupo de recurrencia.
- Datos de confirmacion.
- IDs de Google Calendar.

## Flujo tecnico de audio

```text
Navegador
  -> MediaRecorder captura audio
  -> Frontend sube archivo a API
  -> Django guarda archivo en /data/audio
  -> Sesion pasa a PROCESANDO
  -> Celery toma tarea
  -> PyannoteAI diariza si hay token
  -> Whisper transcribe en espanol
  -> ECAPA identifica voz del psicologo
  -> Backend fusiona transcripcion + diarizacion
  -> Guarda segmentos con hablante y embeddings
  -> Sesion pasa a COMPLETADO
```

## Flujo tecnico de RAG

```text
Pregunta del psicologo
  -> generate_text_embedding(pregunta)
  -> pgvector busca segmentos similares del paciente
  -> Se diversifican fuentes por sesion
  -> Se agrega contexto de ficha clinica
  -> DeepSeek recibe prompt con reglas clinicas
  -> Se guarda respuesta y fuentes
  -> La respuesta puede guardarse como InformeIA
```

## Flujo tecnico de tests

```text
Psicologo asigna test
  -> Backend genera token seguro
  -> Guarda hash del token, no el token plano
  -> Genera URL publica
  -> Envia email si SMTP esta configurado
  -> Paciente responde sin login
  -> Backend valida respuestas completas
  -> Calcula puntajes por dimensiones
  -> Crea sesion TEST_PSICOLOGICO
  -> Segmenta resultados e indexa embeddings
  -> DeepSeek genera observacion IA si esta configurado
```

## Flujo tecnico de agenda y Google Calendar

```text
Psicologo crea cita
  -> Backend valida cruces de horario
  -> Si hay recurrencia, crea ocurrencias semanales/quincenales
  -> Guarda citas
  -> Si Google esta conectado, sincroniza evento
  -> Puede pedir confirmacion por WhatsApp prellenado
  -> Puede convertir prospecto en paciente
```

## Extension Chrome

### Funcion actual

Captura subtitulos visibles en Google Meet y Zoom Web Client.

### Componentes

- `content-meet.js`: lee filas de captions de Google Meet.
- `content-zoom.js`: lee captions de Zoom.
- `content-app.js`: sincroniza ID de sesion y token desde la app hacia Chrome storage.
- `background.js`: acumula captions y los envia al backend.

### Mecanismos importantes

- Polling cada 1.5 segundos.
- Buffer persistente en `chrome.storage.local`.
- Flush inmediato con debounce.
- Flush al cerrar la pestana mediante `keepalive`.
- Envio al endpoint `/api/sesiones/{id}/caption/`.

## Endpoints principales

Base API: `/api/`

| Area | Endpoint |
|---|---|
| Login | `/auth/token/` |
| Refresh token | `/auth/token/refresh/` |
| Usuario actual | `/auth/me/` |
| Crear usuario | `/auth/users/` |
| Pacientes | `/pacientes/` |
| Sesiones | `/sesiones/` |
| Subir audio | `/sesiones/{id}/upload_audio/` |
| Subir documento | `/sesiones/upload_documento/` |
| Crear virtual | `/sesiones/crear_virtual/` |
| Enviar caption | `/sesiones/{id}/caption/` |
| Finalizar virtual | `/sesiones/{id}/finalizar_virtual/` |
| Exportar sesion PDF | `/sesiones/{id}/exportar_pdf/` |
| Exportar sesion DOCX | `/sesiones/{id}/exportar_docx/` |
| Perfil voz | `/voz/` |
| Enroll voz | `/voz/enroll/` |
| Chat | `/chat/conversaciones/` |
| Informes IA | `/chat/informes/` |
| Catalogo tests | `/evaluaciones/catalogo/` |
| Asignar test | `/evaluaciones/asignaciones/` |
| Test publico | `/evaluaciones/publicas/{token}/` |
| Responder test | `/evaluaciones/publicas/{token}/responder/` |
| Agenda | `/agenda/citas/` |
| Google status | `/agenda/google/status/` |
| Google connect | `/agenda/google/connect/` |
| Google sync | `/agenda/google/sync/` |

## Paginas principales del frontend

| Ruta | Uso |
|---|---|
| `/login` | Login del psicologo |
| `/dashboard` | Lista y creacion de pacientes |
| `/dashboard/pacientes/[id]` | Ficha, sesiones, chat, informes, documentos y tests |
| `/dashboard/pacientes/[id]/sesiones/[sesionId]` | Grabacion, transcripcion, notas, resultados y exportaciones |
| `/dashboard/voz` | Perfil de voz del psicologo |
| `/dashboard/agenda` | Calendario clinico |
| `/dashboard/tests` | Catalogo de tests |
| `/dashboard/usuarios/crear` | Crear usuarios para Admin |
| `/tests/[token]` | Pagina publica para responder test |

## Landing marketing existente

La carpeta `marketing/` contiene una landing separada con estas secciones:

- Navegacion.
- Hero.
- Prueba/social/trust.
- Problema.
- Features en bento.
- Como funciona.
- Biometria de voz.
- Seguridad.
- Pricing.
- FAQ.
- CTA final.
- Footer.

## Observacion tecnica para marketing

La landing actual contiene algunos claims que van mas alla de lo visible en el codigo. Para una pagina publica seria recomendable ajustar o validar:

- `AES-256 en reposo`: no se ve cifrado de aplicacion en el codigo revisado.
- `TLS 1.3`: depende de infraestructura de despliegue, no del docker local.
- `Datos alojados en Chile`: depende del hosting real.
- `Ley 19.628 + GDPR`: requiere validacion legal y procesos asociados.
- `PHQ-9, GAD-7, BAI/BDI`: no se observan implementados; si aparecen, deben ir como roadmap.
- `Graba videollamada Meet/Zoom`: la extension actual captura captions.

## Estado tecnico general

El producto esta en estado beta funcional avanzado. Tiene modulos reales, base de datos, procesos asincronos, integraciones y landing. Aun requiere validacion de infraestructura, seguridad, cumplimiento legal, pricing final y consistencia de marca antes de vender claims fuertes.
