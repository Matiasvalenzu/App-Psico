# Plan Maestro y Especificación Técnica: Sistema de Videollamada Propia Psiconex (Meet Interno)

> **Documento de especificación directa para Claude Opus / Equipo de Desarrollo.**
> Diseñado para ejecución precisa, quirúrgica y con mínimo consumo de tokens.

---

## 1. Resumen Ejecutivo y Arquitectura Seleccionada

Psiconex incorporará una solución propia de videollamadas 1-a-1 integrada directamente en la aplicación, eliminando la dependencia de Google Meet o Zoom externos y dotando a la plataforma de autonomía total.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ARQUITECTURA DEL SISTEMA                      │
└────────────────────────────────────────────────────────────────────────┘

  [ Ficha Paciente ] ──> Crea Sesión Virtual ──> Genera token_sala único
           │
           ├─────────────── Compartir Enlace ──────────────┐
           │ (WhatsApp / Copiar Enlace / Email)            │
           ▼                                               ▼
┌──────────────────────┐                       ┌──────────────────────┐
│  Pantalla Psicólogo  │                       │  Lobby / Paciente    │
│  /pacientes/[id]/    │                       │  /sala/[token]       │
│  sesiones/[id]/sala  │                       │  (Pública, sin login)│
└──────────┬───────────┘                       └──────────┬───────────┘
           │                                              │
           │  1. Handshake WebSocket (Offer / Answer)     │
           │◄──────────────────┐      ┌──────────────────►│
           │                   ▼      ▼                   │
           │          ┌───────────────────────┐           │
           │          │ Servidor Señalización │           │
           │          │ Node.js/ws (Docker)   │           │
           │          └───────────────────────┘           │
           │                                              │
           │  2. Conexión P2P Directa (WebRTC Audio/Video)│
           │◄════════════════════════════════════════════►│
           │  (STUN Google + Fallback TURN Metered.ca)    │
           │                                              │
           │  3. Grabación DUAL-TRACK en el navegador     │
           │     - Pista L: Micrófono Psicólogo           │
           │     - Pista R: Audio Remoto Paciente         │
           ▼                                              │
┌──────────────────────┐                                  │
│ Finalizar Sesión     │                                  │
│ - Sube 2 pistas audio│                                  │
│ - Envía notas_sesion │                                  │
└──────────┬───────────┘                                  │
           ▼                                              │
┌─────────────────────────────────────────────────────────┴──────────┐
│ Backend Django + Celery                                            │
│ - Tarea: procesar_audio_dual_track                                 │
│ - Whisper procesa Pista Psicólogo -> TranscripcionSegmento (PSIC)   │
│ - Whisper procesa Pista Paciente  -> TranscripcionSegmento (PAC)    │
│ - CERO gasto en Pyannote / 100% precisión en identificación        │
└────────────────────────────────────────────────────────────────────┘
```

### Ventajas de esta Arquitectura
1. **$0 Costo de Servidor de Video**: El video y el audio viajan directamente entre navegadores (P2P). La VPS de Psiconex no transcodifica video ni se satura.
2. **Identificación de Hablantes 100% Infalible (Diarización Determinista)**: Al grabarse en pistas aisladas en el navegador del psicólogo, sabemos con certeza matemática qué onda sonora proviene del psicólogo y cuál del paciente. **No se requiere Pyannote AI ni modelos de diarización costosos** para las sesiones virtuales.
3. **Máxima Privacidad (E2EE)**: Conexión cifrada punto a punto según el estándar WebRTC (DTLS-SRTP).
4. **Resiliencia de Red**: STUN público de Google con fallback a TURN gestionado freemium (Metered.ca o similar) para garantizar conexión en redes 4G/5G y entornos clínicos con cortafuegos estrictos.

---

## 2. Mapa de Archivos: Rutas y Responsabilidades

### Backend (Django)
| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/sesiones/models.py` | Modificar | Agregar `token_sala` (UUID/slug único), `plataforma_virtual="PSICONEX"`, y estado de videollamada. |
| `backend/sesiones/views.py` | Modificar | Agregar acciones: `crear_virtual_propia`, `info_sala_publica` (sin login para el paciente), y `finalizar_videollamada` (recibe audios duales). |
| `backend/sesiones/tasks.py` | Modificar | Crear tarea Celery `procesar_audio_dual_track`: corre Whisper por separado para cada pista y guarda `TranscripcionSegmento`. |
| `backend/sesiones/serializers.py` | Modificar | Serializar `token_sala` y URL pública de la sala. |

### Microservicio de Señalización WebRTC (Nuevo)
| Archivo | Acción | Responsabilidad |
|---|---|---|
| `signaling/server.js` | Crear | Servidor WebSocket ultraligero (~50 líneas) con salas por `token_sala` para retransmitir `join`, `offer`, `answer` e `ice-candidate`. |
| `signaling/package.json` | Crear | Dependencia única: `"ws": "^8.16.0"`. |
| `signaling/Dockerfile` | Crear | Imagen Node Alpine (~25MB RAM). |
| `docker-compose.yml` / `docker-compose.prod.yml` / `docker-compose-dev.yml` | Modificar | Declarar el servicio `signaling` en puerto 8080. |
| `docker/nginx/default.conf` | Modificar | Enrutar `/ws/signaling/` hacia `http://signaling:8080` con upgrade de WebSockets. |

### Frontend (Next.js)
| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/src/hooks/useWebRTC.ts` | Crear | Hook que gestiona `RTCPeerConnection`, WebSocket de señalización, ICE candidates y reconexión. |
| `frontend/src/hooks/useDualTrackRecorder.ts` | Crear | Hook que graba el stream local (psicólogo) y el stream remoto (paciente) en dos audios o estéreo L/R independientes usando Web Audio API. |
| `frontend/src/components/sesion/ModalCrearSesionVirtual.tsx` | Crear | Modal en la ficha del paciente para crear la llamada, copiar enlace, botón WhatsApp, enviar email y entrar a la sala. |
| `frontend/src/app/dashboard/pacientes/[id]/page.tsx` | Modificar | Botón "Sesión Virtual Psiconex" que abre el modal. |
| `frontend/src/app/dashboard/pacientes/[id]/sesiones/[sesionId]/sala/page.tsx` | Crear | **Pantalla del Psicólogo**: Modo Consulta Clínica (Video principal paciente, PiP propio, panel lateral de notas en vivo + ficha rápida, controles y finalizar). |
| `frontend/src/app/sala/[token]/page.tsx` | Crear | **Pantalla Pública del Paciente**: Pre-call Lobby (test cámara/mic, mensaje de bienvenida) + Videollamada limpia sin login. |

---

## 3. Especificación Técnica Backend (Django)

### 3.1. Modelo `Sesion` (`backend/sesiones/models.py`)
```python
import uuid

class Sesion(models.Model):
    # En Plataforma agregar:
    class Plataforma(models.TextChoices):
        GOOGLE_MEET = "GOOGLE_MEET", "Google Meet"
        ZOOM = "ZOOM", "Zoom"
        PSICONEX = "PSICONEX", "Psiconex Meet"

    class EstadoVideollamada(models.TextChoices):
        CREADA = "CREADA", "Creada"
        EN_CURSO = "EN_CURSO", "En curso"
        FINALIZADA = "FINALIZADA", "Finalizada"

    # Nuevos campos
    token_sala = models.CharField(
        max_length=64, unique=True, null=True, blank=True, db_index=True
    )
    estado_videollamada = models.CharField(
        max_length=20,
        choices=EstadoVideollamada.choices,
        default=EstadoVideollamada.CREADA,
    )
```

### 3.2. Endpoints en `backend/sesiones/views.py`

#### A. Crear Sesión Virtual Propia (`POST /api/sesiones/crear_virtual_propia/`)
- **Autenticación**: Requerida (Psicólogo).
- **Body**: `{ "paciente_id": 123, "fecha_hora_inicio": "..." (opcional) }`
- **Lógica**:
  1. Genera `token = uuid.uuid4().hex`.
  2. Crea `Sesion` con `origen=Sesion.Origen.VIRTUAL`, `plataforma_virtual="PSICONEX"`, `token_sala=token`.
  3. `url_reunion = f"{settings.PUBLIC_APP_URL}/sala/{token}"`.
  4. Retorna objeto sesión serializado junto con `url_reunion` y datos del paciente.

#### B. Info Pública de la Sala (`GET /api/sesiones/sala/<token>/`)
- **Autenticación**: `AllowAny` (pública, el paciente no tiene login).
- **Lógica**:
  1. Busca `sesion = Sesion.objects.filter(token_sala=token).first()`.
  2. Si no existe o `estado_videollamada == FINALIZADA`, retorna 404/410 con mensaje amigable ("Esta sesión ya ha finalizado o el enlace no es válido").
  3. Retorna:
     ```json
     {
       "valida": true,
       "sesion_id": sesion.id,
       "paciente_nombre": sesion.paciente.nombre_completo,
       "psicologo_nombre": sesion.psicologo.get_full_name() or "Especialista Psiconex",
       "estado_videollamada": sesion.estado_videollamada
     }
     ```

#### C. Finalizar Videollamada y Enviar Audios (`POST /api/sesiones/<id>/finalizar_videollamada/`)
- **Autenticación**: Requerida (Psicólogo).
- **Multipart Form Data**:
  - `audio_psicologo`: Archivo WebM/WAV del psicólogo.
  - `audio_paciente`: Archivo WebM/WAV del paciente.
  - `notas_sesion`: Texto de notas tomadas durante la llamada (opcional).
- **Lógica**:
  1. Actualiza `sesion.notas_sesion = notas_sesion` si viene presente.
  2. `sesion.estado_videollamada = Sesion.EstadoVideollamada.FINALIZADA`.
  3. `sesion.estado = Sesion.Estado.PROCESANDO`.
  4. Guarda los dos archivos en `settings.AUDIO_STORAGE_PATH`:
     - `pista_psicologo_{sesion.id}.webm`
     - `pista_paciente_{sesion.id}.webm`
  5. Despacha la tarea en segundo plano:
     ```python
     procesar_audio_dual_track.delay(
         sesion_id=sesion.id,
         audio_path_psicologo=path_psi,
         audio_path_paciente=path_pac
     )
     ```
  6. Retorna `{ "ok": true, "mensaje": "Procesando transcripción" }`.

### 3.3. Tarea Celery: `procesar_audio_dual_track` (`backend/sesiones/tasks.py`)
```python
@shared_task(bind=True, max_retries=1)
def procesar_audio_dual_track(self, sesion_id, audio_path_psicologo, audio_path_paciente):
    sesion = Sesion.objects.get(id=sesion_id)
    nombre_psicologo = sesion.psicologo.get_full_name() or "Psicólogo"
    nombre_paciente = sesion.paciente.nombre_completo

    # 1. Transcribir pista del Psicólogo con Whisper
    segmentos_psicologo = _run_whisper(audio_path_psicologo)
    for seg in segmentos_psicologo:
        seg["hablante"] = TranscripcionSegmento.Hablante.PSICOLOGO
        seg["speaker_label"] = nombre_psicologo

    # 2. Transcribir pista del Paciente con Whisper
    segmentos_paciente = _run_whisper(audio_path_paciente)
    for seg in segmentos_paciente:
        seg["hablante"] = TranscripcionSegmento.Hablante.PACIENTE
        seg["speaker_label"] = nombre_paciente

    # 3. Intercalar cronológicamente por tiempo de inicio (start)
    todos = sorted(segmentos_psicologo + segmentos_paciente, key=lambda x: x["start"])

    # 4. Guardar TranscripcionSegmento con embeddings
    TranscripcionSegmento.objects.filter(sesion=sesion).delete()
    for idx, seg in enumerate(todos, start=1):
        embedding = generate_text_embedding(seg["text"]) if settings.EMBEDDING_USE_MODEL else None
        TranscripcionSegmento.objects.create(
            sesion=sesion,
            orden=idx,
            inicio_segundo=seg["start"],
            fin_segundo=seg["end"],
            hablante=seg["hablante"],
            speaker_label=seg["speaker_label"],
            texto=seg["text"],
            embedding=embedding
        )

    # 5. Marcar sesión como completada
    sesion.duracion_segundos = int(max(
        (todos[-1]["end"] if todos else 0),
        get_audio_duration_seconds(audio_path_psicologo)
    ))
    sesion.estado = Sesion.Estado.COMPLETADO
    sesion.save(update_fields=["estado", "duracion_segundos", "updated_at"])
```

---

## 4. Servidor de Señalización WebRTC (`signaling/`)

### 4.1. Código del Servidor (`signaling/server.js`)
```javascript
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Psiconex WebRTC Signaling Server Active\n');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map(); // roomId -> Set of ws clients

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const { type, roomId, payload } = message;

      if (type === 'join') {
        currentRoom = roomId;
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        const room = rooms.get(roomId);
        room.add(ws);

        // Notificar al room si hay otro participante listo
        const clientCount = room.size;
        ws.send(JSON.stringify({ type: 'joined', clientCount }));
        if (clientCount === 2) {
          room.forEach((client) => {
            client.send(JSON.stringify({ type: 'ready' }));
          });
        }
        return;
      }

      // Reenviar offer, answer, ice-candidate al otro cliente en la sala
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, payload }));
          }
        });
      }
    } catch (err) {
      console.error('Signaling error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.delete(ws);
      room.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'peer-disconnected' }));
        }
      });
      if (room.size === 0) rooms.delete(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling running on port ${PORT}`);
});
```

### 4.2. Dockerfile (`signaling/Dockerfile`)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

### 4.3. Nginx (`docker/nginx/default.conf`)
Agregar el bloque de upgrade de WebSockets:
```nginx
location /ws/signaling/ {
    proxy_pass http://signaling:8080/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

---

## 5. Especificación Frontend (Next.js)

### 5.1. Hook de Grabación Dual-Track (`frontend/src/hooks/useDualTrackRecorder.ts`)
Este hook es la pieza maestra que garantiza la diarización perfecta.

```typescript
import { useRef, useCallback } from "react";

export function useDualTrackRecorder() {
  const localRecorderRef = useRef<MediaRecorder | null>(null);
  const remoteRecorderRef = useRef<MediaRecorder | null>(null);
  const localChunksRef = useRef<Blob[]>([]);
  const remoteChunksRef = useRef<Blob[]>([]);

  const startDualRecording = useCallback((localStream: MediaStream, remoteStream: MediaStream) => {
    localChunksRef.current = [];
    remoteChunksRef.current = [];

    // 1. Grabar audio del psicólogo (solo audio track)
    const localAudioStream = new MediaStream(localStream.getAudioTracks());
    const localRecorder = new MediaRecorder(localAudioStream, { mimeType: "audio/webm;codecs=opus" });
    localRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) localChunksRef.current.push(e.data);
    };
    localRecorder.start(1000);
    localRecorderRef.current = localRecorder;

    // 2. Grabar audio del paciente (solo audio track)
    const remoteAudioStream = new MediaStream(remoteStream.getAudioTracks());
    const remoteRecorder = new MediaRecorder(remoteAudioStream, { mimeType: "audio/webm;codecs=opus" });
    remoteRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) remoteChunksRef.current.push(e.data);
    };
    remoteRecorder.start(1000);
    remoteRecorderRef.current = remoteRecorder;
  }, []);

  const stopDualRecording = useCallback(async (): Promise<{ audioPsicologo: Blob; audioPaciente: Blob }> => {
    return new Promise((resolve) => {
      let stoppedCount = 0;
      const checkDone = () => {
        stoppedCount++;
        if (stoppedCount === 2) {
          const audioPsicologo = new Blob(localChunksRef.current, { type: "audio/webm" });
          const audioPaciente = new Blob(remoteChunksRef.current, { type: "audio/webm" });
          resolve({ audioPsicologo, audioPaciente });
        }
      };

      if (localRecorderRef.current && localRecorderRef.current.state !== "inactive") {
        localRecorderRef.current.onstop = checkDone;
        localRecorderRef.current.stop();
      } else checkDone();

      if (remoteRecorderRef.current && remoteRecorderRef.current.state !== "inactive") {
        remoteRecorderRef.current.onstop = checkDone;
        remoteRecorderRef.current.stop();
      } else checkDone();
    });
  }, []);

  return { startDualRecording, stopDualRecording };
}
```

### 5.2. Hook WebRTC (`frontend/src/hooks/useWebRTC.ts`)
- Configuración ICE:
  ```typescript
  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // Configuración TURN opcional para redes restringidas
      ...(process.env.NEXT_PUBLIC_TURN_URL ? [{
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
      }] : [])
    ]
  };
  ```
- Manejo de Offer/Answer y cola de ICE Candidates (`earlyCandidatesQueue`): Si llega un candidate antes de `setRemoteDescription`, se almacena en memoria y se añade una vez establecida la descripción remota.
- Manejo de tracks: `pc.ontrack = (event) => setRemoteStream(event.streams[0])`.

### 5.3. Vista del Psicólogo: Modo Consulta Clínica
**Ruta**: `frontend/src/app/dashboard/pacientes/[id]/sesiones/[sesionId]/sala/page.tsx`
- **Disposición**:
  - `75% ancho`: Video remoto (paciente grande), video local (PiP en esquina inferior con toggle arrastrable), barra de controles flotante:
    - Botón Micrófono (Mute/Unmute con feedback visual).
    - Botón Cámara (On/Off).
    - Botón Compartir Pantalla (`navigator.mediaDevices.getDisplayMedia`).
    - Botón "Finalizar Sesión" (Rojo destacado con modal de confirmación).
    - Badge animado: `● Grabando sesión (Audio Dual-HD)`.
  - `25% ancho (Panel Lateral Colapsable)`:
    - Pestaña 1: **Bloc de Notas Clínicas**. Textarea persistente en tiempo real.
    - Pestaña 2: **Ficha Rápida del Paciente**. Alergias, motivo de consulta, diagnósticos y notas de sesiones previas.
- **Flujo al presionar "Finalizar Sesión"**:
  1. Detiene la grabación dual (`stopDualRecording()`).
  2. Crea un `FormData` con `audio_psicologo`, `audio_paciente` y `notas_sesion`.
  3. Muestra spinner "Subiendo audio y guardando sesión...".
  4. Llama a `apiFetch('/sesiones/${sesionId}/finalizar_videollamada/', { method: 'POST', body: formData })`.
  5. Cierra tracks de cámara y micrófono.
  6. Redirige automáticamente a `/dashboard/pacientes/[id]/sesiones/[sesionId]` donde se activa el polling nativo de Celery que muestra la transcripción una vez finalizada.

### 5.4. Vista del Paciente: Pre-Call Lobby + Llamada Limpia
**Ruta**: `frontend/src/app/sala/[token]/page.tsx`
- **Fase 1: Pre-call Lobby (Antes de entrar)**:
  - Header limpio con branding de Psiconex.
  - Título: *"Bienvenido/a a tu sesión con [Nombre del Psicólogo]"*.
  - Vista previa de cámara en tiempo real para peinarse/acomodarse.
  - Indicador dinámico de nivel de micrófono (barra verde que salta al hablar para asegurar que el mic funciona).
  - Botón: *"Unirse a la sesión"*.
  - Si el psicólogo aún no entra: cartel *"El profesional te admitirá en cuanto inicie la sesión..."*.
- **Fase 2: En la Videollamada**:
  - Pantalla completa con el video del psicólogo.
  - Video propio en miniatura.
  - Barra inferior limpia: Silenciar mic, Apagar cámara, Salir de la llamada.
  - Si el psicólogo comparte pantalla, el stream de video conmuta suavemente al contenido compartido.
- **Fase 3: Post-Llamada**:
  - Mensaje cálido: *"La sesión ha finalizado. Gracias por confiar en Psiconex."*.

---

## 6. Sugerencias Maestras y "Gotchas" Críticos para Claude

1. **Auto-Play Policy de los Navegadores**:
   En navegadores modernos (especialmente Safari en iPhone/iPad y Chrome en Android), los elementos `<video>` no pueden reproducir audio automáticamente a menos que haya habido una interacción del usuario (un clic).
   - *Solución*: En la vista del paciente, el botón "Unirse a la sesión" en el lobby sirve como la interacción requerida para invocar `.play()` en el elemento de video remoto.
2. **Eco Acústico y Web Audio API**:
   Si se conecta el stream remoto a un `AudioContext` para grabarlo, **NUNCA** se debe conectar el destino a `audioContext.destination`, ya que el navegador ya reproduce el audio del elemento `<video>` de forma nativa. Si se conecta a `destination`, el psicólogo escuchará un eco retardado insoportable.
   - *Solución*: El `remoteStream` se pasa directamente a una instancia separada de `MediaRecorder` o a un `MediaStreamAudioDestinationNode` aislado.
3. **Manejo de Desconexión del Paciente**:
   Si el paciente pierde la conexión WiFi o recarga la página, el WebSocket debe enviar el evento `peer-disconnected`. El hook `useWebRTC` debe reiniciar el `RTCPeerConnection` y quedar esperando la nueva oferta sin abortar la grabación del psicólogo.
4. **Almacenamiento de Audio**:
   Asegurarse de que el backend guarde los audios en la ruta configurada en `settings.AUDIO_STORAGE_PATH` (`/data/audio`), accesible por el contenedor Celery a través del volumen compartido en Docker.

---

## 7. Pasos de Ejecución para Claude Opus

1. **Paso 1: Backend Django**
   - Actualizar `Sesion` en `backend/sesiones/models.py`.
   - Ejecutar migración: `python manage.py makemigrations` y `migrate`.
   - Agregar endpoints en `backend/sesiones/views.py`.
   - Agregar tarea `procesar_audio_dual_track` en `backend/sesiones/tasks.py`.
2. **Paso 2: Microservicio Signaling**
   - Crear carpeta `signaling/` con `server.js`, `package.json` y `Dockerfile`.
   - Agregar servicio a `docker-compose.yml`, `docker-compose-dev.yml` y `docker-compose.prod.yml`.
   - Actualizar `docker/nginx/default.conf` con el bloque `/ws/signaling/`.
3. **Paso 3: Frontend Hooks & Modal**
   - Crear `useDualTrackRecorder.ts` y `useWebRTC.ts`.
   - Crear `ModalCrearSesionVirtual.tsx` y enlazarlo en la ficha del paciente.
4. **Paso 4: Pantallas de Videollamada**
   - Implementar la sala pública del paciente en `frontend/src/app/sala/[token]/page.tsx`.
   - Implementar la sala clínica del psicólogo en `frontend/src/app/dashboard/pacientes/[id]/sesiones/[sesionId]/sala/page.tsx`.
5. **Paso 5: Validación**
   - Probar handshake localmente entre dos pestañas de navegador (una autenticada como psicólogo y una incógnito como paciente).
   - Verificar que al finalizar la videollamada se generen los `TranscripcionSegmento` con los nombres correctos del psicólogo y paciente.
