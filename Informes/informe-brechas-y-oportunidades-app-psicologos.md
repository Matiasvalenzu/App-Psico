# Informe de brechas y oportunidades para la aplicación de psicólogos

**Fuente principal:** `Reuniones/Reunion1.txt`  
**Contraste técnico:** desarrollo actual del proyecto en `backend/` y `frontend/`  
**Fecha base de la reunión:** 04/06/2026  
**Participantes:** Lina Barraza, Benjamín Valenzuela, Paulo Valenzuela, Matías Valenzuela  
**Objetivo del documento:** identificar qué ideas de la reunión potencian la aplicación actual, qué ya está construido, qué no existe todavía y qué conviene implementar primero.

## 1. Resumen ejecutivo

La aplicación actual ya tiene una base técnica valiosa: pacientes, sesiones, grabación de audio, transcripción, identificación de hablantes, sesiones virtuales, carga de documentos externos, chat IA por paciente y exportación PDF de sesión. Eso significa que el proyecto no parte desde cero. El núcleo técnico más difícil ya existe.

La reunión con Lina mostró que la mayor oportunidad no es agregar funciones aisladas, sino convertir esa base técnica en una plataforma realmente clínica y operativa para psicólogos. Hoy la aplicación resuelve parte del flujo de sesiones, pero todavía no cubre varios dolores que Lina describió como críticos en su práctica diaria.

Las oportunidades más importantes que actualmente no están cubiertas son:

- Ficha clínica ampliada con datos reales que usa una psicóloga en atención.
- Número correlativo automático de sesión por paciente.
- Objetivos de intervención y seguimiento del proceso terapéutico.
- Tests psicológicos digitalizados, corregidos automáticamente y asociados al paciente.
- Informes clínicos IA persistentes, descargables y reutilizables como contexto.
- Consentimiento informado y control ético/legal de grabación o transcripción.
- Agenda clínica con frecuencia de atención, recordatorios y estados de sesión.
- Registro de pagos, tarifas diferenciadas y futura integración con boletas.
- Analítica para el psicólogo: origen de pacientes, ingresos, tests aplicados y evolución.
- Listas personalizadas por psicólogo para valores, heridas, áreas, técnicas, objetivos y temas.

La recomendación principal es no reconstruir lo que ya tenemos. Hay que aprovechar la base actual y ampliar el producto hacia tres frentes prioritarios: ficha clínica avanzada, módulo de tests e informes IA persistentes.

## 2. Estado actual de la aplicación

Esta sección resume lo que ya está implementado según la revisión del código actual.

### 2.1 Pacientes

La app ya tiene modelo `Paciente` en `backend/pacientes/models.py`.

Campos actuales:

- Psicólogo dueño del paciente.
- Nombre.
- Apellido.
- Fecha de nacimiento.
- RUT.
- Edad.
- Sexo.
- Ocupación laboral.
- Motivo de consulta.
- Notas privadas.
- Estado activo.
- Fechas de creación y actualización.

La pantalla principal `frontend/src/app/dashboard/page.tsx` permite listar pacientes, buscar por nombre o apellido y crear un paciente con campos básicos.

La pantalla de detalle `frontend/src/app/dashboard/pacientes/[id]/page.tsx` permite ver y editar datos básicos del paciente.

### 2.2 Sesiones

La app ya tiene modelo `Sesion` en `backend/sesiones/models.py`.

Tipos de origen actuales:

- `AUDIO`: sesión grabada/presencial.
- `DOCUMENTO_EXTERNO`: documento cargado y tratado como contexto.
- `VIRTUAL`: sesión virtual capturada desde Meet/Zoom.

Estados actuales:

- Pendiente.
- Procesando.
- Completado.
- Error.

Funciones actuales:

- Crear sesiones por paciente.
- Subir audio.
- Procesar audio con pipeline de transcripción y diarización.
- Cargar documentos TXT/DOCX/PDF y convertirlos en segmentos de texto.
- Crear sesiones virtuales para Google Meet o Zoom.
- Capturar captions desde extensión.
- Finalizar sesión virtual y convertir captions en segmentos.
- Guardar notas de sesión.
- Editar transcripción y hablante.
- Exportar sesión a PDF y Word.
- Separar documentos externos de las sesiones clínicas en la ficha del paciente.
- Abrir, descargar y eliminar documentos externos desde una sección propia.

### 2.3 Transcripción y hablantes

La app ya tiene `TranscripcionSegmento` con:

- Orden.
- Inicio y fin en segundos.
- Hablante: psicólogo, paciente o documento.
- Speaker label.
- Score de match.
- Texto.
- Texto original.
- Embedding vectorial.

También existe `SpeakerIdentificationResult`, que registra resultados de identificación de hablantes mediante perfil de voz.

### 2.4 Perfil de voz

La app ya tiene `VoiceProfile` en `backend/voz/models.py`.

El perfil permite asociar una voz al usuario psicólogo mediante embedding. Esto es importante porque en la reunión se explicó que la IA necesita saber quién habla: psicólogo o paciente.

### 2.5 Chat IA por paciente

La app ya tiene conversaciones IA en `backend/chat/models.py` y `backend/chat/views.py`.

Características actuales:

- Conversaciones por paciente y psicólogo.
- Mensajes de usuario y asistente.
- Búsqueda de contexto usando embeddings de segmentos.
- Fuentes asociadas a respuestas.
- Prompt base para responder como asistente especializado para psicólogos clínicos.
- Uso de DeepSeek.

Esto ya cubre parcialmente la idea de “hablar con las sesiones pasadas”, pero todavía falta estructurar mejor las respuestas, guardar informes como documentos clínicos y conectar otros tipos de contexto como tests, objetivos o diagnósticos.

### 2.6 Exportación

La app ya puede exportar sesiones y documentos externos a PDF y Word. En sesiones clínicas, la exportación incluye datos de la sesión, notas y transcripción. En documentos externos, la exportación conserva el contenido extraído del archivo cargado.

## 3. Brecha principal entre la app actual y la reunión

La aplicación actual está orientada a capturar y consultar sesiones. La reunión mostró que el producto debe evolucionar hacia una plataforma de gestión clínica completa para psicólogos.

La diferencia es esta:

| Dimensión | Estado actual | Oportunidad detectada |
|---|---|---|
| Pacientes | Ficha básica | Ficha clínica, administrativa y de riesgo mucho más completa |
| Sesiones | Grabación, virtual, documentos, notas y transcripción | Número correlativo, objetivos, técnica, desarrollo, próxima sesión e hitos |
| IA | Chat contextual por segmentos | Informes estructurados, persistentes, con objetivos, tests y DSM-5 |
| Tests | No existe módulo de tests | Digitalizar tests, calcular puntajes y asociarlos al paciente |
| Agenda | No hay agenda clínica completa | Calendario, frecuencia, recordatorios y estado de sesión |
| Pagos | No hay módulo de pagos | Registro de pagos, tarifas diferenciadas, deuda y boleta pendiente |
| Consentimiento | No se ve modelo de consentimiento | Consentimiento informado y permiso de grabación/transcripción |
| Analítica | No hay dashboard de negocio | Origen de pacientes, ingresos, uso de tests y evolución |
| Personalización | No hay listas configurables por psicólogo | Categorías propias: valores, heridas, técnicas, temas, áreas |
| Producto comercial | App en beta funcional | Plataforma de nicho para psicólogos con planes y add-ons |

## 4. Lo que no debemos duplicar

Antes de definir nuevas tareas, es importante reconocer qué ya existe y no debe rehacerse.

No conviene rehacer desde cero:

- Registro de pacientes.
- Autenticación y separación por psicólogo.
- Creación de sesiones.
- Grabación de audio presencial.
- Pipeline de transcripción.
- Identificación de hablantes.
- Perfil de voz del psicólogo.
- Edición manual de transcripción.
- Carga de documentos externos.
- Sesiones virtuales con Meet/Zoom vía captions.
- Chat IA por paciente con recuperación de contexto.
- Exportación PDF de sesión.

La estrategia correcta es extender estos módulos.

## 5. Oportunidades nuevas que actualmente no existen

### 5.1 Ficha clínica ampliada

**Estado actual:** la ficha tiene datos básicos: nombre, apellido, RUT, fecha de nacimiento, edad, sexo, ocupación, motivo de consulta y notas privadas.

**Hallazgo de la reunión:** Lina usa muchos más datos en su ficha real. Algunos son clínicos, otros administrativos y otros de seguridad.

**Oportunidad:** transformar la ficha actual en una ficha clínica psicológica más completa, organizada por secciones.

Campos nuevos recomendados:

| Campo | Razón clínica o administrativa |
|---|---|
| WhatsApp | Medio práctico de contacto frecuente |
| Correo | Comunicación y envío de links/tests |
| Nacionalidad | Contexto y registro |
| Religión | Relevante para algunos enfoques o procesos |
| Dirección actual | Registro administrativo |
| Comuna | Segmentación y contexto |
| Previsión | Dato administrativo usado por psicólogos/centros |
| Menor de edad | Activa datos de tutor/responsable |
| Tutor o responsable | Necesario si el paciente es menor |
| Persona de confianza | Relevante por riesgo o emergencia |
| Contacto de emergencia | Crítico ante ideación suicida o riesgo |
| Derivación o interconsulta | Permite registrar origen clínico |
| Origen comercial | Instagram, referido, CAF, boca a boca, otro |
| Diagnóstico sospechado | Hipótesis inicial del profesional |
| Problemática principal | Motivo clínico más estructurado |
| Medicación actual | Dato relevante para seguimiento |
| Riesgo suicida | Campo de alerta crítica |
| Escala de ideación | Seguimiento simple de riesgo sesión a sesión |
| Frecuencia de atención | Semanal, quincenal, mensual, seguimiento |
| Tarifa diferenciada | Valor particular del paciente |
| Observaciones generales | Información transversal del proceso |

**Implementación sugerida:** no poner todos los campos en un formulario largo. Usar secciones plegables: datos básicos, contacto, antecedentes clínicos, riesgo, administración y origen.

**Prioridad:** alta.

### 5.2 Consentimiento informado

**Estado actual:** no se observó un modelo específico para consentimiento informado.

**Hallazgo de la reunión:** Lina explicó que el consentimiento informado debe firmarse al inicio del proceso, especialmente si se grabará o transcribirá la sesión.

**Oportunidad:** agregar un módulo simple de consentimiento antes de escalar el uso de grabaciones.

Funciones recomendadas:

- Estado del consentimiento en ficha del paciente.
- Fecha de firma.
- Versión del consentimiento.
- Checkbox de autorización de grabación/transcripción.
- Archivo adjunto o texto aceptado.
- Alerta si se intenta grabar sin consentimiento.

**Implementación sugerida:** crear entidad `ConsentimientoInformado` asociada a paciente y psicólogo. En una primera versión puede ser un registro manual: “firmado”, fecha y observación.

**Prioridad:** alta por riesgo ético/legal.

### 5.3 Número correlativo automático de sesión

**Estado actual:** las sesiones tienen fecha y estado, pero no se observó un campo explícito de número de sesión por paciente.

**Hallazgo de la reunión:** Lina indicó que hoy debe contar manualmente las sesiones y eso produce errores. Mencionó el caso de un paciente registrado como sesión 47 cuando ya iba en sesión 51.

**Oportunidad:** mostrar y guardar automáticamente `Sesión 1`, `Sesión 2`, `Sesión 3` por paciente.

Funciones recomendadas:

- Calcular número al crear sesión.
- Mostrar número en tarjetas de sesión.
- Mostrar número en detalle de sesión y PDF.
- Permitir corregirlo manualmente solo si es necesario.
- Usar el número para alertas de reevaluación.

**Implementación sugerida:** agregar `numero_sesion` a `Sesion`, asignarlo según paciente al crear. Si se eliminan sesiones, evitar renumerar automáticamente para no alterar historial clínico.

**Prioridad:** muy alta por bajo esfuerzo y alto valor.

### 5.4 Objetivos de intervención

**Estado actual:** el paciente tiene `motivo_consulta` y la sesión tiene `notas_sesion`, pero no existe una estructura de objetivos terapéuticos.

**Hallazgo de la reunión:** Lina propuso registrar “proceso de intervención” u “objetivos de intervención” para luego pedirle a la IA qué se ha trabajado y qué falta.

**Oportunidad:** crear objetivos clínicos asociados al paciente y enlazarlos con sesiones.

Funciones recomendadas:

- Registrar objetivos iniciales.
- Marcar objetivos activos, logrados, pausados o descartados.
- Asociar una sesión a uno o más objetivos.
- Pedir a la IA resumen de avance por objetivo.
- Detectar objetivos no trabajados en varias sesiones.

**Implementación sugerida:** partir con un campo texto largo `objetivos_intervencion` en paciente. Luego evolucionar a entidad separada `ObjetivoIntervencion`.

**Prioridad:** alta.

### 5.5 Estructura clínica de cada sesión

**Estado actual:** cada sesión tiene `notas_sesion` como texto libre.

**Hallazgo de la reunión:** Lina mostró que en Medilink existen campos como número de sesión, objetivo, técnica aplicada, desarrollo y objetivo de próxima sesión. Aunque Medilink no le parece amigable, esa estructura sí tiene valor.

**Oportunidad:** evolucionar `notas_sesion` hacia secciones clínicas opcionales.

Campos sugeridos para `Sesion`:

| Campo | Uso |
|---|---|
| numero_sesion | Correlativo por paciente |
| tema_sesion | Tema u objetivo principal |
| tecnica_aplicada | Técnica usada por el psicólogo |
| desarrollo | Desarrollo clínico de la sesión |
| objetivo_proxima_sesion | Plan o foco siguiente |
| tareas_paciente | Actividades o acuerdos para el paciente |
| observaciones_clinicas | Notas privadas relevantes |
| riesgo_sesion | Nivel de riesgo detectado en esa sesión |

**Implementación sugerida:** mantener `notas_sesion` para compatibilidad y agregar campos nuevos gradualmente. En frontend, mostrar pestañas o bloques simples.

**Prioridad:** media-alta.

### 5.6 Timeline de evolución del paciente

**Estado actual:** la pantalla de paciente lista sesiones, pero la reunión pide una navegación más clínica y rápida.

**Hallazgo de la reunión:** Lina quiere revisar sesiones como separadores o pestañas, similar a buscar rápidamente en una Biblia. También se habló de hitos y línea de tiempo.

**Oportunidad:** convertir la lista de sesiones en una línea de tiempo clínica.

Debe mostrar:

- Número de sesión.
- Fecha.
- Tipo: presencial, remota, documento, test, informe.
- Estado.
- Resumen breve.
- Hitos marcados.
- Tests aplicados.
- Informes generados.

**Implementación sugerida:** primero mejorar las tarjetas actuales con número de sesión y mini resumen. Luego agregar filtros por tipo de evento.

**Prioridad:** media.

### 5.7 Informes IA persistentes

**Estado actual:** existe chat IA y se guardan mensajes. No existe una entidad clara de informe clínico generado, versionado, descargable y asociado al paciente.

**Hallazgo de la reunión:** se conversó que el informe no debería quedar solo en el chat. Debe poder guardarse, descargarse y reutilizarse como contexto.

**Oportunidad:** crear un módulo `InformeIA`.

Tipos de informe sugeridos:

- Resumen clínico del paciente.
- Evolución por rango de sesiones.
- Plan sugerido para próxima sesión.
- Informe de test aplicado.
- Informe de derivación o interconsulta.
- Resumen de objetivos trabajados y pendientes.
- Informe de riesgo o seguimiento.

Funciones necesarias:

- Generar desde chat o botón específico.
- Guardar como documento asociado al paciente.
- Descargar como PDF.
- Editar antes de cerrar.
- Usar como contexto futuro para IA.
- Limitar tamaño para controlar costo.

**Implementación sugerida:** crear modelo `InformeIA` con paciente, psicólogo, tipo, título, contenido, fuentes y fecha. Inicialmente puede generarse desde una respuesta del chat con botón “Guardar como informe”.

**Prioridad:** alta.

### 5.8 Prompt IA más estructurado

**Estado actual:** el prompt del backend pide responder en español, citar fechas y ser objetivo. Es correcto, pero general.

**Hallazgo de la reunión:** se necesita que la IA responda en bloques útiles para psicólogos, no como chat genérico.

**Oportunidad:** especializar el asistente con una estructura clínica.

Respuesta recomendada:

```markdown
## Resumen del proceso
...

## Temas trabajados
...

## Objetivos pendientes
...

## Indicadores relevantes
...

## Tests aplicados
...

## Alertas o riesgos
...

## Sugerencias para próxima sesión
...

## Límites de la respuesta
...
```

Reglas sugeridas:

- No diagnosticar de forma definitiva.
- Usar “hipótesis”, “sugerencia” o “elemento a explorar”.
- Recordar que el criterio final es del psicólogo.
- No entregar consejos directos al paciente.
- Separar evidencia observada de inferencias.

**Implementación sugerida:** ajustar `_consultar_deepseek` para incluir un prompt más clínico y estructurado. Más adelante, permitir prompts por tipo de informe.

**Prioridad:** alta.

### 5.9 DSM-5 como base de conocimiento

**Estado actual:** el asistente solo usa contexto de segmentos de sesiones. No se observó base documental DSM-5.

**Hallazgo de la reunión:** Lina y Paulo mencionaron que el DSM-5 sería una base clave para orientar diagnósticos psicológicos de forma profesional.

**Oportunidad:** usar DSM-5 como referencia para hipótesis diagnósticas, no como diagnóstico automático.

Uso correcto:

- Consultar criterios cuando el psicólogo pregunte.
- Sugerir hipótesis compatibles con síntomas descritos.
- Indicar información faltante para evaluar.
- Evitar conclusiones definitivas.
- Registrar diagnóstico seleccionado por el psicólogo, no por la IA.

**Implementación sugerida:** primero agregar selector manual de diagnóstico o campo de diagnóstico sospechado. Luego implementar RAG con documento DSM-5 si hay permiso de uso.

**Prioridad:** media por valor alto, pero con cuidado legal y clínico.

### 5.10 Módulo de tests psicológicos

**Estado actual:** no existe módulo de tests.

**Hallazgo de la reunión:** este fue el hallazgo más potente. Lina mostró tests que hoy resuelve con Google Forms, Excel, fórmulas, puntajes manuales y archivos sueltos.

**Oportunidad:** digitalizar tests y convertirlos en un producto diferencial de la app.

Funciones mínimas:

- Crear definición de test.
- Registrar preguntas.
- Registrar alternativas.
- Definir reglas de puntuación.
- Enviar link al paciente.
- Recibir respuestas.
- Calcular puntajes automáticamente.
- Asociar resultado al paciente.
- Mostrar interpretación al psicólogo.
- Generar informe IA privado para el psicólogo.
- Permitir exportar o compartir versión revisada.

Tests mencionados:

| Test | Oportunidad |
|---|---|
| Creencias de Albert Ellis | Primer candidato por reglas matemáticas claras |
| Rueda de la vida | Resultado gráfico útil para paciente y psicólogo |
| Heridas de infancia / máscaras | Útil para ficha terapéutica y objetivos |
| Test de valores | Conecta con áreas de intervención de Lina |
| Depression Inventory | Potencial futuro, revisar licencia y validación |
| 16PF | Potencial alto, requiere temporizador y reglas estrictas |
| ADOS/A2 | Alto valor, pero requiere certificación y cuidado legal |
| Rorschach y proyectivos | Futuro; más complejo por interpretación no matemática |

**Principio clave:** la corrección matemática debe hacerla el sistema, no la IA. La IA puede ayudar a redactar interpretación o sugerencias para el psicólogo.

**Prioridad:** muy alta por diferencial comercial.

### 5.11 Links públicos para pacientes

**Estado actual:** el paciente no entra a la app. Esto es correcto para el panel clínico, pero falta un flujo para que responda tests.

**Hallazgo de la reunión:** Lina envía links de Google Forms. La idea es reemplazar eso por links propios de la plataforma.

**Oportunidad:** crear links públicos seguros para responder tests sin acceder al panel del psicólogo.

Requisitos:

- Link único por aplicación de test.
- Token seguro.
- Vencimiento opcional.
- Asociación automática con paciente y psicólogo.
- Evitar bloqueo por correo repetido.
- Estado: enviado, abierto, respondido, vencido.
- No mostrar recomendaciones IA al paciente por defecto.

**Prioridad:** alta si se implementa el módulo de tests.

### 5.12 Listas y categorías configurables por psicólogo

**Estado actual:** no se observan listas personalizadas por psicólogo.

**Hallazgo de la reunión:** Lina, Benjamín y Paulo coincidieron en que cada psicólogo tiene categorías distintas. No conviene que nosotros intentemos definir todo.

**Oportunidad:** permitir que cada psicólogo cree listas simples.

Ejemplos:

- Valores.
- Heridas.
- Máscaras.
- Áreas a trabajar.
- Técnicas.
- Temas de sesión.
- Objetivos frecuentes.
- Motivos de consulta.
- Diagnósticos frecuentes.

**Implementación sugerida:** crear `CategoriaPersonalizada` y `OpcionPersonalizada`. En interfaz, permitir agregar una opción nueva desde el mismo formulario sin salir de la sesión.

**Prioridad:** media.

### 5.13 Agenda clínica

**Estado actual:** las sesiones tienen fecha/hora, pero no hay una agenda completa.

**Hallazgo de la reunión:** Lina usa su planilla como calendario semanal. También comparó con plataformas que recuerdan pacientes.

**Oportunidad:** convertir sesiones programadas en una agenda real.

Funciones recomendadas:

- Vista semanal y mensual.
- Crear sesión agendada sin transcripción todavía.
- Frecuencia por paciente.
- Estado: agendada, atendida, cancelada, no asistió.
- Próxima sesión.
- Recordatorio interno.
- Recordatorio por correo o WhatsApp en etapa posterior.

**Implementación sugerida:** partir reutilizando `Sesion` con estado pendiente y fecha futura. Más adelante separar `Cita` si se necesita.

**Prioridad:** media-alta.

### 5.14 Pagos, tarifas y boletas

**Estado actual:** no se observó módulo de pagos.

**Hallazgo de la reunión:** Lina registra pagos y boletas manualmente. Encuadrado es atractivo porque automatiza agenda, recordatorios y boletas.

**Oportunidad:** agregar un módulo administrativo básico para no perder contra herramientas como Encuadrado.

Primera versión:

- Valor de sesión por paciente.
- Tarifa diferenciada.
- Estado de pago por sesión.
- Pago mensual o por proceso.
- Deuda pendiente.
- Boleta emitida: sí/no.
- Observaciones de pago.

Etapa posterior:

- Integración con proveedor de boletas vía API.
- Pagos online.
- Recordatorios automáticos.
- Reporte mensual de ingresos.

**Prioridad:** media. No es el diferencial clínico principal, pero sí pesa comercialmente.

### 5.15 Analítica para el psicólogo

**Estado actual:** no hay dashboard de métricas clínicas/comerciales.

**Hallazgo de la reunión:** Lina registra origen del paciente para saber de dónde vienen sus consultas. Benjamín lo vio como punto de venta.

**Oportunidad:** dar al psicólogo estadísticas simples.

Métricas recomendadas:

- Pacientes nuevos por mes.
- Origen de pacientes.
- Ingresos mensuales.
- Sesiones realizadas.
- Sesiones canceladas.
- Pacientes activos.
- Pacientes sin próxima sesión.
- Tests aplicados.
- Tests más usados.
- Pacientes por frecuencia de atención.

**Prioridad:** media.

### 5.16 Videollamada integrada

**Estado actual:** la app soporta sesión virtual con Meet/Zoom vía extensión y captions.

**Hallazgo de la reunión:** Paulo propuso una videollamada dentro de la plataforma, con link propio al paciente.

**Oportunidad:** visión futura para no depender de Meet/Zoom/Teams.

Beneficios:

- Mejor control de audio.
- Mejor captura de transcripción.
- Menos pestañas.
- Experiencia más integrada.
- Posible diferenciación fuerte.

**Prioridad:** baja para MVP. Alta para visión futura.

## 6. Oportunidades comerciales derivadas de brechas

### 6.1 Diferenciación por nicho psicológico

La reunión dejó claro que las plataformas genéricas se sienten médicas o demasiado amplias. Nuestra app debe evitar ese error.

Propuesta comercial:

**Una plataforma hecha específicamente para psicólogos: ficha clínica, sesiones, transcripción, IA, tests, informes, agenda y pagos en un solo lugar.**

### 6.2 Tests como producto monetizable

El módulo de tests puede ser más que una funcionalidad. Puede ser una fuente de ingresos.

Modelos posibles:

- Plan base con pocos tests incluidos.
- Créditos por aplicación de test.
- Packs de tests por enfoque.
- Cobro por test premium.
- Comisión por aplicación si el psicólogo cobra al paciente.
- Marketplace futuro de tests digitalizados.

Este punto es especialmente relevante porque Lina explicó que los tests permiten vender procesos terapéuticos más completos y caros.

### 6.3 Informes IA como límite de plan

Spegnosis cobra por cantidad de informes y plantillas. Nuestra app podría usar lógica similar.

Opciones:

- Plan inicial con cierta cantidad de informes IA.
- Plan profesional con más informes.
- Informes adicionales pagados.
- Límite mensual alto de tokens para evitar abuso.

### 6.4 Marcha blanca con psicólogos reales

La reunión reforzó que se necesitan psicólogos involucrados. Lina aportó una mirada distinta y Mauricio puede validar el uso real.

Acciones comerciales inmediatas:

- Usar a Mauricio como primer usuario piloto.
- Pedir feedback de tests y precio de aplicación.
- Pedir a Lina los cuatro tests y la planilla vacía.
- Preparar una demo enfocada en dolor real, no en tecnología.
- Usar boca a boca con psicólogos cercanos.

## 7. Priorización recomendada

### 7.1 Implementar primero

Estas tareas tienen alto impacto y conectan directamente con la reunión.

| Prioridad | Oportunidad | Por qué ahora |
|---|---|---|
| 1 | Número correlativo de sesión | Dolor explícito, bajo esfuerzo, mejora inmediata |
| 2 | Ficha clínica ampliada | La ficha actual quedó corta frente al uso real |
| 3 | Objetivos de intervención | Permite IA mucho más útil por paciente |
| 4 | Prompt IA estructurado | Mejora el valor del chat existente sin gran cambio técnico |
| 5 | Guardar respuesta IA como informe | Convierte chat en documento clínico útil |
| 6 | Consentimiento informado básico | Reduce riesgo por grabación/transcripción |
| 7 | Primer test digitalizado | Diferencial comercial más fuerte detectado |

### 7.1.1 Estado de implementación actualizado

Actualización posterior a la segunda iteración de desarrollo: se implementaron los primeros cinco puntos priorizados y luego se incorporó el primer test digitalizado. Consentimiento informado queda pendiente para una etapa posterior.

| Prioridad | Oportunidad | Estado | Implementación realizada |
|---|---|---|---|
| 1 | Número correlativo de sesión | Implementado | Se agregó `numero_sesion` a `Sesion`, con backfill de sesiones existentes y asignación automática para sesiones presenciales/remotas. Se muestra en lista, detalle y PDF. |
| 2 | Ficha clínica ampliada | Implementado | Se ampliaron campos de `Paciente` para contacto, datos administrativos, riesgo, emergencia, derivación, diagnóstico sospechado, medicación, frecuencia y otros datos clínicos. |
| 3 | Objetivos de intervención | Implementado | Se agregó `objetivos_intervencion` en la ficha del paciente y se muestra como bloque clínico propio. También se incluye como contexto del asistente IA. |
| 4 | Prompt IA estructurado | Implementado | El asistente ahora responde con enfoque clínico prudente, separando evidencia e inferencias, evitando diagnósticos definitivos y usando bloques estructurados. |
| 5 | Guardar respuesta IA como informe | Implementado | Se creó `InformeIA`, endpoint para guardar respuestas del asistente y sección de informes IA guardados en la ficha del paciente, con apertura, eliminación y descarga PDF/Word. |
| 6 | Consentimiento informado básico | Pendiente | Se mantiene fuera de esta iteración. |
| 7 | Primer test digitalizado | Implementado | Se creó el Test de Creencias Ellis con catálogo, vista previa, link público con token, expiración de 7 días, uso único, respuesta sin autenticación, cálculo automático, sesión clínica tipo test, observación IA prudente con apoyo DSM-5, descarga PDF/Word y eliminación. El envío por correo quedó preparado y en espera de credenciales SMTP. |

### 7.2 Implementar después

| Prioridad | Oportunidad | Razón |
|---|---|---|
| 8 | Link público para responder tests | Implementado dentro del primer módulo de test; queda pendiente conectar SMTP real |
| 9 | Timeline clínico | Mejora experiencia cuando hay muchas sesiones |
| 10 | Agenda básica | Expande la app hacia operación diaria |
| 11 | Pagos básicos | Aumenta valor administrativo |
| 12 | Analítica | Útil para venta y gestión, pero no bloquea MVP clínico |
| 13 | DSM-5 con RAG | Alto valor, pero requiere cuidado legal y clínico |

### 7.3 Dejar como visión futura

| Oportunidad | Motivo para postergar |
|---|---|
| Videollamada propia | Alto esfuerzo técnico; ya existe camino con Meet/Zoom |
| Boleta automática | Requiere proveedor/API y validaciones fiscales |
| Marketplace de tests | Depende de licencias y biblioteca inicial |
| Tests proyectivos avanzados | Requieren interpretación y observación profesional compleja |
| Portal completo del paciente | Puede aumentar riesgos y complejidad de privacidad |

## 8. Plan de implementación propuesto

### Fase 1: Aterrizar la app actual al flujo clínico real

Objetivo: mejorar el producto existente sin construir módulos gigantes.

Tareas:

- Agregar `numero_sesion` a `Sesion`.
- Mostrar número de sesión en lista, detalle y PDF.
- Renombrar botones: `Sesión presencial` y `Sesión remota`.
- Agregar campos ampliados mínimos en paciente.
- Agregar `objetivos_intervencion` en paciente.
- Ajustar prompt IA a formato clínico estructurado.
- Botón “Guardar como informe” en respuestas IA.
- Mantener consentimiento informado básico para una etapa posterior.

### Fase 2: Primer módulo de tests

Objetivo: construir el diferencial comercial detectado en la reunión.

Tareas:

- Test de Creencias Ellis digitalizado como primer MVP.
- Catálogo de tests con vista previa de preguntas y vista paciente.
- Aplicación de test por paciente con token público, expiración de 7 días y uso único.
- Cálculo automático de puntajes por dimensión.
- Resultado guardado como sesión clínica tipo test dentro de la ficha.
- Observación IA prudente apoyada en DSM-5, sin diagnóstico automático.
- Resultados disponibles como conocimiento para el chat IA mediante segmentos con embeddings.
- Descarga PDF/Word y eliminación del resultado desde la sesión.
- Envío por correo preparado; pendiente de credenciales SMTP.

### Fase 3: Evolución clínica y analítica

Objetivo: que la app ayude a gestionar procesos largos.

Tareas:

- Timeline clínico con sesiones, tests e informes.
- Hitos clínicos manuales.
- Objetivos trabajados por sesión.
- Resúmenes acumulados por paciente.
- Dashboard básico de pacientes y actividad.

### Fase 4: Operación administrativa

Objetivo: competir con herramientas de agenda/pago sin perder foco clínico.

Tareas:

- Agenda semanal.
- Frecuencia de atención.
- Estado de sesión.
- Registro de pagos.
- Boleta pendiente/manual.
- Métricas de ingresos y origen de pacientes.

## 9. Cambios sugeridos en modelos actuales

Esta sección traduce la reunión a cambios concretos sobre lo ya construido.

### 9.1 Extender `Paciente`

Campos inmediatos:

- `telefono_whatsapp`
- `email_contacto`
- `nacionalidad`
- `religion`
- `direccion`
- `comuna`
- `prevision`
- `es_menor_edad`
- `nombre_tutor`
- `telefono_tutor`
- `contacto_emergencia_nombre`
- `contacto_emergencia_telefono`
- `origen_consulta`
- `derivacion_interconsulta`
- `diagnostico_sospechado`
- `medicacion_actual`
- `riesgo_suicida`
- `frecuencia_atencion`
- `tarifa_diferenciada`
- `objetivos_intervencion`

### 9.2 Extender `Sesion`

Campos inmediatos:

- `numero_sesion`
- `tema_sesion`
- `tecnica_aplicada`
- `desarrollo_sesion`
- `objetivo_proxima_sesion`
- `tareas_paciente`
- `riesgo_sesion`

### 9.3 Crear `ConsentimientoInformado`

Campos sugeridos:

- `paciente`
- `psicologo`
- `firmado`
- `fecha_firma`
- `version`
- `autoriza_grabacion`
- `autoriza_transcripcion`
- `archivo_path`
- `observaciones`

### 9.4 Crear `InformeIA`

Campos sugeridos:

- `paciente`
- `psicologo`
- `sesion` opcional.
- `tipo`
- `titulo`
- `contenido`
- `fuentes_json`
- `generado_desde_chat_mensaje` opcional.
- `created_at`
- `updated_at`

### 9.5 Crear modelos de tests

Modelos sugeridos:

- `TestDefinicion`
- `TestPregunta`
- `TestAlternativa`
- `TestEscala`
- `TestReglaPuntuacion`
- `TestAplicacion`
- `TestRespuesta`
- `TestResultado`

Para el primer MVP se puede simplificar y usar JSON para reglas, siempre que se mantenga ordenado.

## 10. Riesgos y consideraciones

### 10.1 Licencias de tests

No todos los tests se pueden digitalizar o vender libremente. Antes de comercializar un test, revisar derechos de autor, licencias y requisitos de certificación.

### 10.2 Datos sensibles

La app maneja salud mental, transcripciones y posibles diagnósticos. Debe proteger acceso por psicólogo, evitar exposición accidental y controlar exportaciones.

### 10.3 IA clínica

La IA debe apoyar al psicólogo, no reemplazarlo. Cualquier diagnóstico debe presentarse como hipótesis o sugerencia.

### 10.4 Alcance excesivo

La reunión generó muchas ideas. Si se intenta implementar todo al mismo tiempo, se puede perder foco. La ruta recomendada es: ficha clínica, número de sesión, IA estructurada, informes y primer test.

### 10.5 Costo de IA

El chat actual usa `max_tokens=2000`, pero si se agregan informes largos y más contexto, el costo puede subir. Conviene guardar informes y resúmenes para no regenerar todo cada vez.

## 11. Conclusión

La aplicación actual ya tiene una base técnica fuerte: pacientes, sesiones, transcripción, voz, documentos externos separados, sesiones virtuales, chat IA, tests psicológicos con enlace público y exportación PDF/Word. La reunión no indica que haya que cambiar de dirección, sino que muestra cómo convertir esa base en una plataforma mucho más valiosa para psicólogos reales.

Las ideas más importantes que siguen pendientes son consentimiento informado, agenda/pagos y analítica. La primera iteración incorporó ficha clínica avanzada, número de sesión automático, objetivos de intervención, prompt IA estructurado e informes IA persistentes; la segunda incorporó el primer test digitalizado con link público y resultado clínico asociado a la ficha.

La oportunidad más diferenciadora es el módulo de tests. Puede transformarse en una ventaja clínica y comercial porque reduce trabajo manual, permite al psicólogo ofrecer procesos más completos y abre modelos de cobro adicionales.

La ruta recomendada es implementar primero las brechas que conectan directamente con lo que ya tenemos. En vez de construir una app nueva, hay que extender la actual para que cada módulo existente responda a un dolor real de la reunión.

## 12. Checklist inmediato para desarrollo

- Número de sesión automático: implementado.
- Textos `Sesión presencial` y `Sesión remota`: implementado.
- Ficha del paciente con campos clínicos y administrativos ampliados: implementado.
- Objetivos de intervención: implementado.
- Prompt IA con formato clínico estructurado: implementado.
- Botón para guardar respuesta IA como informe: implementado.
- Informes IA con apertura, eliminación y descarga PDF/Word: implementado.
- Documentos externos separados de sesiones clínicas, con apertura, eliminación y descarga PDF/Word: implementado.
- Primer test digitalizado: implementado con Test de Creencias Ellis.
- Link público para responder test sin autenticación: implementado con expiración de 7 días y uso único.
- Resultados de test como sesión clínica y conocimiento para chat IA: implementado.
- Correo automático para tests: preparado, pendiente de credenciales SMTP.
- Consentimiento informado básico: pendiente para etapa posterior.
- Pedir a Lina los próximos tests con preguntas, reglas y criterios.
- Validar con Mauricio cuánto valor le da al módulo de tests y cuánto cobra por aplicarlos.
