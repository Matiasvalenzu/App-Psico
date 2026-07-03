# IA, datos, privacidad y limites clinicos

## Principio central

Psiconex debe comunicarse como una herramienta de apoyo al psicologo. La IA ordena informacion, resume, recupera contexto y sugiere focos de revision, pero no diagnostica ni reemplaza el criterio clinico.

## Donde se usa IA

| Uso | Tecnologia | Estado |
|---|---|---|
| Transcripcion de audio | faster-whisper | Implementado |
| Diarizacion de hablantes | PyannoteAI API | Implementado si hay token |
| Identificacion de voz del psicologo | ECAPA-TDNN SpeechBrain | Implementado |
| Embeddings de texto | pgvector + modelo opcional | Implementado |
| Chat contextual por paciente | DeepSeek | Implementado si hay API key |
| Informes IA | DeepSeek | Implementado si hay API key |
| Observacion IA de tests | DeepSeek + contexto DSM-5 local opcional | Implementado si hay API key |

## Datos sensibles tratados

La aplicacion puede almacenar o procesar:

- Datos identificatorios del paciente.
- Contacto: email, telefono, direccion.
- Datos clinicos: motivo de consulta, diagnostico sospechado, medicacion, riesgo suicida, objetivos.
- Audios de sesiones.
- Transcripciones.
- Documentos externos.
- Tests psicologicos y respuestas.
- Observaciones IA.
- Informes clinicos.
- Agenda de atenciones.
- Tokens de integracion Google Calendar.

Por eso toda comunicacion publica debe ser prudente y no prometer cumplimiento legal sin respaldo.

## Separacion de datos por usuario

El backend filtra informacion por `request.user` en pacientes, sesiones, chat, informes, evaluaciones y agenda. Cada psicologo ve sus propios registros.

Ejemplos:

- Pacientes: `Paciente.objects.filter(psicologo=request.user)`.
- Sesiones: se filtran por `paciente__psicologo=request.user`.
- Chat: se filtra por `psicologo=request.user`.
- Agenda: se filtra por `psicologo=request.user`.
- Voz: un perfil por usuario.

## Manejo de tokens

- Autenticacion con JWT.
- Access token dura 30 minutos.
- Refresh token dura 4 horas.
- Frontend guarda tokens en `localStorage`.
- La extension Chrome usa el token para enviar captions al backend.

## Consideracion de seguridad

Guardar tokens en `localStorage` es comun en MVPs, pero tiene riesgos frente a XSS. Para una version comercial robusta, evaluar cookies httpOnly, CSP, hardening frontend y auditoria.

## Servicios externos y datos que podrian salir del servidor

### PyannoteAI

La diarizacion sube audio a PyannoteAI mediante API si `PYANNOTE_AUTH_TOKEN` esta configurado.

Implicancia comercial:

- No afirmar que el audio nunca sale del servidor si se usa PyannoteAI API.
- Si se quiere afirmar procesamiento 100% local, habria que cambiar la diarizacion a un modelo self-hosted.

### DeepSeek

El chat IA y observaciones de tests envian contexto textual a DeepSeek si `DEEPSEEK_API_KEY` esta configurada.

Implicancia comercial:

- No afirmar que ningun dato clinico se envia a terceros.
- Si se usa DeepSeek, explicar que se envia contexto necesario para generar respuestas.
- Validar terminos de tratamiento de datos antes de claims publicos.

### Google Calendar

La sincronizacion de agenda usa OAuth y Google Calendar API.

Implicancia comercial:

- Datos de citas pueden sincronizarse con Google si el psicologo conecta su cuenta.
- Es una decision voluntaria del usuario.

### SMTP

El envio de tests por correo usa proveedor SMTP configurado.

Implicancia comercial:

- Si no hay SMTP, el sistema genera enlace para envio manual.

## Claims seguros recomendados

Estos claims son mas prudentes segun el codigo actual:

| Claim | Uso recomendado |
|---|---|
| `Cada psicologo accede solo a sus propios pacientes` | Seguro segun filtros de backend |
| `La IA apoya, no diagnostica` | Seguro y alineado al prompt |
| `Las transcripciones son editables por el profesional` | Seguro |
| `Los informes son revisables y exportables` | Seguro |
| `Puedes registrar sesiones presenciales y online` | Seguro, aclarando online por captions |
| `Integra documentos y tests al historial del paciente` | Seguro |
| `Sincroniza agenda con Google Calendar si lo conectas` | Seguro |
| `Los enlaces de test son personales y expiran` | Seguro |

## Claims que requieren validacion antes de publicar

| Claim | Riesgo |
|---|---|
| `Cifrado AES-256 en reposo` | No se ve implementacion aplicativa en codigo revisado |
| `Cifrado de extremo a extremo` | No corresponde al flujo actual con backend procesando datos |
| `TLS 1.3` | Depende de proxy/infraestructura, no del codigo local |
| `Cumple Ley 19.628` | Requiere revision legal, contratos y procesos |
| `Cumple GDPR` | Requiere DPA, base legal, derechos ARCO/GDPR, procesos |
| `HIPAA compliant` | No afirmar salvo certificacion y controles especificos |
| `Datos alojados en Chile` | Depende del hosting real |
| `El audio nunca sale del servidor` | Falso si se usa PyannoteAI API |
| `Ningun dato se envia a terceros` | Falso si se usa DeepSeek, Google o PyannoteAI |
| `Diagnostico automatico` | No es el objetivo ni debe prometerse |
| `95% de precision` | Requiere benchmark propio y condiciones claras |
| `Ahorra X horas garantizadas` | Requiere medicion real |

## Mensaje correcto sobre IA clinica

Usar:

> Psiconex usa IA para ordenar informacion clinica, recuperar fragmentos relevantes y preparar borradores de informes. El psicologo revisa, corrige y decide.

Evitar:

> Psiconex diagnostica automaticamente y define el tratamiento.

## Mensaje correcto sobre transcripcion

Usar:

> Psiconex genera una transcripcion editable de la sesion y separa hablantes cuando el audio y la configuracion lo permiten.

Evitar:

> Transcripcion perfecta sin revision.

## Mensaje correcto sobre sesiones online

Usar:

> En sesiones por Meet o Zoom, una extension opcional captura subtitulos y los incorpora al historial del paciente.

Evitar:

> Grabamos toda la videollamada y el audio/video queda procesado automaticamente.

## Mensaje correcto sobre tests

Usar:

> El psicologo puede enviar el Test de Creencias Ellis por enlace, recibir respuestas, puntajes e interpretacion de apoyo.

Evitar:

> Tenemos todos los tests psicologicos integrados.

## Consentimiento informado

No se observo un modelo de consentimiento informado implementado en el codigo revisado.

Recomendacion para marketing:

- Hablar de consentimiento como buena practica necesaria.
- No afirmar que el producto ya incluye firma digital o gestion completa de consentimiento si no se implementa.
- Si la landing menciona grabacion/transcripcion, incluir mensaje etico: `El uso de grabacion o transcripcion requiere consentimiento informado del paciente segun normativa aplicable y criterio profesional`.

## Privacidad: texto sugerido prudente

> Psiconex fue disenado para trabajar con informacion clinica sensible. Cada profesional accede a sus propios pacientes y los registros se mantienen bajo control de la cuenta del psicologo. Algunas funciones de IA e integraciones, como transcripcion avanzada, DeepSeek, PyannoteAI o Google Calendar, pueden requerir servicios externos configurables. El profesional decide que funciones activar y debe usar consentimiento informado cuando corresponda.

## Limites clinicos para FAQ

Pregunta:

> La IA diagnostica a mis pacientes?

Respuesta:

> No. Psiconex no reemplaza el criterio clinico. Organiza informacion, resume antecedentes, recupera fragmentos relevantes y ayuda a preparar borradores. La interpretacion final siempre pertenece al psicologo.

Pregunta:

> Puedo usarlo sin enviar datos a servicios externos?

Respuesta sugerida:

> Algunas funciones pueden configurarse localmente y otras dependen de servicios externos. Conviene revisar el modo de despliegue antes de prometer procesamiento 100% interno.

## Recomendaciones antes de lanzamiento comercial

- Definir politica de privacidad publica.
- Definir terminos de servicio.
- Definir consentimiento informado recomendado para pacientes.
- Revisar contratos con proveedores de IA.
- Confirmar hosting real y pais de residencia de datos.
- Definir estrategia de backups y borrado.
- Agregar auditoria de accesos si se vende a clinicas.
- Validar legalmente claims sobre Ley 19.628, GDPR o cualquier normativa.
- Endurecer manejo de tokens y cabeceras de seguridad para produccion.

## Resumen para el experto en marketing

La confianza es una parte central del producto. La venta no debe basarse en exagerar la IA, sino en mostrar que Psiconex reduce carga administrativa manteniendo al psicologo en control del registro, la interpretacion y las decisiones clinicas.
