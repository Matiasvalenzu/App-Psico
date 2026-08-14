# Herramienta Psicólogo — contexto del proyecto

## Stack
- **Backend**: Django 4 + DRF en `backend/`, puerto 8000
- **Frontend**: Next.js 14 + Tailwind en `frontend/`, puerto 3000
- **DB**: PostgreSQL 15 + pgvector, puerto 5432
- **Cola**: Redis + Celery (worker de audio), `concurrency=1`
- **Orquestación local**: Docker Compose (`docker-compose-dev.yml` en raíz)
- **Producción**: `docker-compose.yml` en raíz, no usar para desarrollo local

## Comandos frecuentes
```bash
docker-compose -f docker-compose-dev.yml up -d                        # levantar todo local
docker-compose -f docker-compose-dev.yml restart celery               # recargar worker tras cambios en tasks.py
docker-compose -f docker-compose-dev.yml restart frontend             # recargar frontend tras cambios en código
docker-compose -f docker-compose-dev.yml logs --no-color --tail=80 celery    # logs del pipeline de audio
docker-compose -f docker-compose-dev.yml exec -T db psql -U psicologo -d psicologo -c "<SQL>"
```

## Estructura backend (`backend/`)
```
config/settings/base.py   — settings centrales (WHISPER_*, PYANNOTE_API_*, SPEAKER_*)
sesiones/tasks.py         — pipeline de audio (Whisper → PyannoteAI API → ECAPA)
sesiones/models.py        — Sesion, TranscripcionSegmento, SpeakerIdentificationResult
pacientes/models.py       — Paciente
voz/models.py             — VoiceProfile
voz/services.py           — embeddings de voz (get_speaker_encoder con lru_cache)
```

## Pipeline de audio (sesiones/tasks.py)
1. `_get_whisper_model()` — carga Whisper una vez por proceso (cache global `_whisper_model`)
2. `_run_diarization()` — sube el audio a PyannoteAI API y espera el job de diarización
3. Diarización con `min_speakers=1, max_speakers=2` (psicólogo + paciente)
4. Identificación por ECAPA: score ≥ `SPEAKER_MATCH_THRESHOLD` (0.35) con margen 0.05
5. Segmentos guardados en `TranscripcionSegmento` con embedding de texto

## Estructura frontend (`frontend/src/`)
```
app/login/page.tsx              — login con logo DatnexiA
app/dashboard/layout.tsx        — header con logo, nav (Pacientes / Voz / Crear Usuario)
app/dashboard/page.tsx          — lista de pacientes
app/dashboard/pacientes/[id]/   — ficha de paciente
app/dashboard/voz/page.tsx      — grabación de perfil de voz
lib/api.ts                      — cliente HTTP (JWT en localStorage)
public/logo-wordmark.jpg        — logo DatnexiA (1600×471)
public/logo-icon.jpg            — ícono DatnexiA (1455×1600)
```

## Git
- Remote: `git@github-app-psicologo:Matiasvalenzu/App-Psico.git`
- Llave SSH: `~/.ssh/app-psicologo_ed25519` (configurada en `~/.ssh/config`)
- Rama principal: `main`
- No es necesario `ssh-add` — la llave se usa directo vía config

## Producción (VPS)
- Acceso: `ssh psiconex-vps` (`root@72.60.59.142`)
- Llave local: `~/.ssh/psiconex_vps_ed25519`; nunca se versiona ni se copia al servidor.
- El host alias está definido en `~/.ssh/config` para despliegues desde este workspace.
- Checkout productivo: `/srv/psiconex-docker/current`; mirror Git: `/srv/psiconex-docker/repository.git`.
- Comandos de producción: `docker compose -p psiconex -f docker-compose.prod.yml`.

## Variables de entorno clave (en docker-compose-dev.yml)
| Variable | Default |
|---|---|
| `WHISPER_MODEL` | `base` |
| `WHISPER_DEVICE` | `cpu` |
| `PYANNOTE_AUTH_TOKEN` | (API key `sk_` requerida para diarización) |
| `PYANNOTE_API_MODEL` | `precision-2` |
| `SPEAKER_MATCH_THRESHOLD` | `0.35` |
| `SPEAKER_MATCH_MARGIN` | `0.05` |
| `DEEPSEEK_API_KEY` | (para chat IA) |

## Notas importantes
- El modelo Whisper se cachea en una variable global del proceso Celery — reiniciar el worker borra el cache
- En ARM64/WSL2 sin GPU, diarizar 56 min toma ~10-15 min (con `max_speakers=2`)
- La primera sesión del día paga el costo de carga de modelos (~1-2 min)
- Los logos JPG tienen fondo blanco — se muestran en contenedor `bg-white rounded-lg`
- Usuario Admin se detecta por `username === "Admin"` o `is_admin === true`
