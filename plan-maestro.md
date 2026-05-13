# Plan Maestro: Herramienta de Asistencia Psicológica con IA

## 1. Visión General

Aplicación web (futuro móvil) que asiste al psicólogo durante y después de las consultas:

1. **Grabación y transcripción automática** de sesiones con distinción de hablantes (psicólogo vs paciente).
2. **Archivo organizado** por paciente con fichas, historial de sesiones y transcripciones etiquetadas.
3. **Chat con IA** (DeepSeek) que procesa los datos del paciente mediante RAG para que el psicólogo pueda consultar patrones, temas recurrentes y detalles clínicos.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Frontend** | Next.js 14 + TypeScript + TailwindCSS + shadcn/ui | SSR opcional, excelente DX, responsive, componentes accesibles |
| **Backend** | Django 5 + Django REST Framework | Robusto, admin nativo, ORM potente, ecosistema maduro |
| **Async tasks** | Celery + Redis | Procesamiento de audio en background sin bloquear la API |
| **DB** | PostgreSQL 16 | JSONB para datos flexibles, pgvector para embeddings |
| **Transcripción** | faster-whisper (self-hosted) | Whisper open-source optimizado, sin costo por uso |
| **Diarización** | pyannote.audio + speaker embedding | Separación de hablantes + matching contra perfil del psicólogo |
| **Vector DB** | pgvector (extensión PostgreSQL) | Sin servicio extra, mismo motor que los datos clínicos |
| **Audio Storage** | Sistema de archivos local | Privacidad total, sin nube externa |
| **IA Chat** | DeepSeek API (vía proxy Django) | API ya disponible por el usuario |
| **Deploy** | Docker Compose + Nginx + Let's Encrypt | Un solo VPS, todo autocontenido |

---

## 3. Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Navegador (Web App React/Next.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Gestión   │ │Grabación │ │Historial │ │Chat IA │ │
│  │Pacientes │ │Sesiones  │ │Sesiones  │ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  MediaRecorder API → captura audio en WAV            │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (JWT Auth)
┌──────────────────────▼──────────────────────────────┐
│  Django REST API + Celery + Redis                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │Auth CRUD │ │Audio     │ │Transcripción     │    │
│  │Pacientes │ │Upload    │ │Pipeline (Celery) │    │
│  │Sesiones  │ │Storage   │ │Whisper+Diariazc. │    │
│  └──────────┘ └──────────┘ └──────────────────┘    │
│  ┌──────────────────────────────────────────────┐   │
│  │ RAG Engine: pgvector + Embeddings + DeepSeek │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  PostgreSQL  │  Redis  │  Filesystem (audio)         │
└─────────────────────────────────────────────────────┘
```

---

## 4. Modelo de Datos

```
Paciente
├── id, nombre, apellido, fecha_nacimiento
├── motivo_consulta, notas_privadas
├── activo (bool)
├── created_at, updated_at
└── sesiones → Sesion[]

Sesion
├── id, paciente (FK), fecha_hora_inicio
├── duracion_segundos
├── audio_path (WAV en filesystem)
├── estado: PENDIENTE | PROCESANDO | COMPLETADO | ERROR
├── notas_sesion (texto libre del psicólogo)
├── created_at, updated_at
└── segmentos → TranscripcionSegmento[]

TranscripcionSegmento
├── id, sesion (FK), orden
├── inicio_segundo, fin_segundo
├── hablante: PSICOLOGO | PACIENTE
├── texto, texto_original (si fue editado)
├── embedding (pgvector halfvec, 1024-dim)
└── created_at

VoiceProfile (único, del psicólogo)
├── id, embedding_vector (float[])
├── fecha_creacion
└── activo (bool)

ChatConversacion
├── id, paciente (FK), titulo
├── created_at, updated_at
└── mensajes → ChatMensaje[]

ChatMensaje
├── id, conversacion (FK)
├── rol: USER | ASSISTANT
├── contenido
├── fuentes_json (ids de segmentos referenciados)
└── created_at
```

---

## 5. Flujo de Uso

```
1. Voice Enrollment (una sola vez)
   └─ Psicólogo graba 3-5 muestras de voz de ~5 seg
   └─ Backend extrae embeddings y los promedia
   └─ Guarda VoiceProfile

2. Crear ficha de paciente
   └─ Nombre, apellido, fecha nacimiento, motivo consulta

3. Iniciar sesión
   ├─ Seleccionar paciente
   ├─ Clic "Iniciar grabación" → MediaRecorder captura audio
   ├─ Durante la sesión: solo indicador de grabación activa
   ├─ Clic "Finalizar sesión" → audio se sube al backend
   └─ Celery procesa en background:
        a. Diarización (pyannote): separa segmentos por hablante
        b. Matching: identifica cuál hablante es el psicólogo
        c. Transcripción (faster-whisper): texto por segmento
        d. Merge: documento final con timestamp + hablante + texto
        e. Generación de embeddings para búsqueda semántica

4. Revisar transcripción
   ├─ Vista de documento con colores por hablante
   ├─ Edición manual si hay errores
   └─ Notas privadas del psicólogo sobre la sesión

5. Chat IA con datos del paciente
   ├─ Psicólogo escribe pregunta
   ├─ Backend busca segmentos relevantes con pgvector
   ├─ DeepSeek responde con referencias a sesiones específicas
   └─ Psicólogo puede seguir el hilo de la conversación
```

---

## 6. Pipeline de Transcripción (Detalle Técnico)

```
Audio WAV (mono, 16kHz)
  │
  ├─ [Celery Task 1] Diarización
  │   └─ pyannote.audio 3.x (modelo pre-entrenado)
  │       └─ output: [(inicio, fin, speaker_label), ...]
  │
  ├─ [Celery Task 2] Speaker Matching
  │   ├─ Para cada speaker_label, extraer voice embedding
  │   ├─ cosine_similarity(embedding, voice_profile)
  │   └─ Si > 0.75 → PSICOLOGO, sino → PACIENTE
  │
  ├─ [Celery Task 3] Transcripción
  │   └─ faster-whisper (modelo large-v3 o medium según GPU)
  │       └─ Para cada segmento diarizado → texto
  │
  ├─ [Celery Task 4] Merge + Embeddings
  │   ├─ Unir segmentos de texto contiguos del mismo hablante
  │   ├─ Generar embeddings (sentence-transformers)
  │   └─ Guardar en PostgreSQL con pgvector
  │
  └─ Notificar al frontend (SSE) que la transcripción está lista
```

---

## 7. Chat IA con RAG (DeepSeek)

```
POST /api/chat/{conversacion_id}/mensaje

1. Generar embedding de la pregunta del psicólogo
2. Buscar top-15 segmentos similares en pgvector (filtrado por paciente)
3. Construir prompt:
   ┌──────────────────────────────────────────────┐
   │ Eres un asistente para psicólogos. Analiza   │
   │ los fragmentos de sesiones del paciente y     │
   │ responde en español. Cita fechas de sesión    │
   │ cuando sea relevante.                         │
   │                                               │
   │ Fragmentos relevantes:                        │
   │ [Sesión 15/03/26 - PACIENTE]: "..."           │
   │ [Sesión 02/04/26 - PSICOLOGO]: "..."          │
   │                                               │
   │ Pregunta: {pregunta}                          │
   └──────────────────────────────────────────────┘
4. Enviar a DeepSeek API
5. Devolver respuesta con fuentes (streaming SSE)
```

---

## 8. Seguridad y Privacidad

| Medida | Implementación |
|--------|---------------|
| **Encriptación en tránsito** | HTTPS con Let's Encrypt |
| **Autenticación** | JWT con refresh tokens, expiración 30 min |
| **Aislamiento de datos** | Single-user (un solo psicólogo administrador) |
| **Audio y transcripciones** | Almacenados solo en el VPS, nunca en cloud |
| **API Key DeepSeek** | Variable de entorno, nunca en código |
| **Backups** | Cron job diario con GPG |
| **Rate limiting** | django-ratelimit en endpoints sensibles |

---

## 9. Dimensionamiento del VPS

| Escenario | Sesiones/día | CPU | RAM | GPU | Procesamiento (sesión 50 min) |
|-----------|-------------|-----|-----|-----|------|
| **Bajo** | 4-6 | 4 vCPU | 8 GB | No | ~15-25 min |
| **Medio** | 6-10 | 8 vCPU | 16 GB | No | ~10-15 min |
| **Alto** | 10+ | 4 vCPU | 16 GB | T4 16GB | ~2-3 min |

- **Audio**: WAV mono 16kHz ~360 MB/hora. 100 GB almacenan ~280 horas de sesiones.
- **Recomendación**: Arrancar con modelo `medium` de faster-whisper. Si hace falta velocidad, pasar a `large-v3` con GPU.

---

## 10. Fases de Implementación

### Fase 1: Fundación (Semana 1-2)
- [x] Setup Django 5 + DRF + PostgreSQL + Docker
- [x] Modelos: Paciente, Sesion (sin transcripción aún)
- [x] Autenticación JWT
- [x] CRUD pacientes (API + frontend básico)
- [x] Admin de Django configurado

### Fase 2: Grabación y Audio (Semana 3-4)
- [x] Componente de grabación en Next.js (MediaRecorder API)
- [x] Upload de audio al backend
- [x] Historial de sesiones por paciente
- [x] Modelo Sesion con audio_path y estados

### Fase 3: Transcripción y Diarización (Semana 5-7)
- [x] Integrar faster-whisper en Celery task
- [x] Integrar pyannote.audio para diarización
- [x] Sistema de voice enrollment del psicólogo
- [x] Speaker matching (psicólogo vs paciente)
- [x] Pipeline completo: audio → transcripción etiquetada
- [x] Vista de transcripción en frontend

### Fase 4: Chat IA + RAG (Semana 8-9)
- [x] Configurar pgvector para embeddings
- [x] Generar embeddings de transcripciones
- [x] Búsqueda semántica
- [x] DeepSeek API integration
- [x] Interfaz de chat en frontend

### Fase 5: Pulido y Producción (Semana 10-11)
- [x] Edición manual de transcripciones
- [x] Exportación de sesiones (PDF)
- [x] Notas del psicólogo durante la sesión
- [x] Deploy en VPS con Docker Compose (config base preparada; requiere dominio/SSL en servidor)
- [x] Monitoreo, logs y backup automático (logs Docker + script de backup; cron se agenda en servidor)

---

## 11. Estructura del Proyecto

```
herramienta-psicologo/
├── docker-compose.yml
├── .env.example
├── plan-maestro.md
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── celery_app.py
│   ├── pacientes/           # App: CRUD pacientes
│   ├── sesiones/            # App: sesiones, audio, transcripción
│   ├── voz/                 # App: voice enrollment, speaker matching
│   ├── chat/                # App: RAG, DeepSeek proxy, conversaciones
│   └── tasks/               # Celery tasks compartidas
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # UI components
│   │   ├── hooks/           # useRecorder, useTranscription, etc.
│   │   └── lib/             # API client, utils
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
└── docker/
    ├── nginx/
    │   └── default.conf
    └── scripts/
        └── entrypoint.sh
```

---

## 12. Costos Mensuales Estimados

| Concepto | Costo |
|----------|-------|
| VPS (ya disponible) | $0 |
| DeepSeek API | ~$2-5/mes (uso moderado de chat) |
| Dominio (opcional) | ~$10/año |
| **Total** | ~$3-6/mes |

---
---

> **Estado**: Plan funcional montado localmente; modelos externos requieren credenciales/configuración de producción
> **Última actualización**: 2026-05-12
