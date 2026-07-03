# Roadmap, brechas y oportunidades comerciales

## Objetivo de este documento

Separar lo que el producto ya tiene de lo que puede convertirse en roadmap o argumento futuro. Esto evita que marketing prometa funciones que aun no estan listas.

## Estado actual resumido

Psiconex ya tiene el nucleo dificil construido:

- Ficha de paciente.
- Sesiones presenciales y virtuales.
- Audio, transcripcion y diarizacion.
- Perfil de voz.
- Documentos externos.
- Chat IA con RAG.
- Informes IA.
- Tests psicologicos con enlace publico.
- Agenda y Google Calendar.
- Exportacion PDF/DOCX.
- Landing inicial.

El producto puede venderse como beta funcional o MVP avanzado, siempre que los claims de seguridad, cumplimiento legal y disponibilidad de funciones se mantengan prudentes.

## Brechas importantes para vender mejor

### 1. Consentimiento informado

Estado actual: no se observo modelo implementado.

Por que importa:

- Es critico para grabacion y transcripcion.
- Reduce objeciones eticas.
- Puede ser una seccion fuerte de confianza en la landing.

Version minima recomendada:

- Estado de consentimiento por paciente.
- Fecha de firma.
- Autorizacion de grabacion/transcripcion.
- Archivo adjunto o texto aceptado.
- Alerta antes de grabar si no existe consentimiento.

Marketing actual:

- Hablar de consentimiento como requisito y buena practica.
- No decir que ya hay firma digital si no se implementa.

### 2. Seguridad y cumplimiento legal

Estado actual: hay autenticacion, separacion por usuario y control basico. No se observo cifrado en reposo de aplicacion ni auditoria formal.

Por que importa:

- Los datos son clinicos y sensibles.
- El usuario psicologo preguntara por confidencialidad.
- Centros o clinicas exigiran mayor control.

Roadmap recomendado:

- Politica de privacidad.
- Terminos de servicio.
- Consentimiento informado.
- Auditoria de accesos.
- Logs de actividad.
- Exportacion y eliminacion de datos.
- Revision legal Ley 19.628.
- Cifrado en reposo a nivel infraestructura o aplicacion.

Marketing actual:

- Evitar claims de certificacion.
- Usar lenguaje prudente: `disenado para proteger informacion clinica`, no `cumple totalmente`.

### 3. Catalogo de tests

Estado actual: Test de Creencias Ellis.

Oportunidad:

- Agregar PHQ-9, GAD-7, BDI, BAI u otros tests segun licencias y validez de uso.
- Permitir catalogo configurable.
- Permitir interpretaciones por test.

Marketing actual:

- Vender `tests psicologicos digitales` solo si se especifica que hoy existe Ellis.
- Otros tests deben figurar como proximamente si aun no estan implementados.

### 4. Pagos y administracion economica

Estado actual: no implementado.

Oportunidad:

- Registrar tarifa por paciente.
- Estado de pago por sesion.
- Deuda pendiente.
- Recordatorios.
- Boleta/factura futura.

Valor comercial:

- Para psicologos independientes, gestion de pagos es dolor real.

Marketing actual:

- No mencionar pagos como feature disponible.

### 5. Analitica de consulta

Estado actual: no implementada como modulo visible.

Oportunidad:

- Pacientes activos.
- Sesiones por semana/mes.
- Origen de pacientes.
- Tests aplicados.
- Ingresos si se implementan pagos.
- Uso de IA.

Marketing actual:

- Puede mencionarse como roadmap para planes de consulta/clinica.

### 6. Plantillas personalizadas de informes

Estado actual: informes IA existen, pero no se observo gestor de plantillas completo.

Oportunidad:

- Plantillas por tipo: evolucion, derivacion, resumen clinico, informe escolar, informe laboral.
- Campos configurables.
- Tono y estructura elegidos por profesional.

Marketing actual:

- Decir `informes editables` es correcto.
- Decir `plantillas personalizadas` solo si se implementa.

### 7. App movil

Estado actual: web responsive; no app nativa.

Oportunidad:

- App movil para revisar agenda, pacientes y notas.
- Grabacion desde telefono.

Marketing actual:

- No prometer app movil.

### 8. Multiusuario avanzado

Estado actual: se pueden crear usuarios desde Admin; cada psicologo tiene sus datos. No se ve estructura avanzada de clinica/equipo/roles.

Oportunidad:

- Organizaciones.
- Roles: admin, psicologo, supervisor, secretaria.
- Pacientes compartidos.
- Auditoria por usuario.
- Permisos por modulo.

Marketing actual:

- Para profesionales independientes: listo.
- Para clinicas: posicionar como futuro o plan a medida con desarrollo adicional.

### 9. Mejoras de precision y control de audio

Estado actual:

- Whisper transcribe.
- PyannoteAI diariza si hay token.
- ECAPA identifica voz.

Oportunidad:

- Panel de calidad de audio.
- Reprocesar sesion.
- Seleccionar modelo Whisper por plan.
- Mostrar confianza por segmento.
- Correcciones mas faciles por bloque.

Marketing actual:

- Hablar de transcripcion editable, no perfecta.

### 10. Onboarding guiado

Estado actual: hay pantallas funcionales, pero no se observo onboarding guiado.

Oportunidad:

- Tutorial inicial.
- Checklist: crear paciente, grabar voz, agendar, crear sesion.
- Demo con datos ficticios.

Valor comercial:

- Reduce friccion de activacion.

## Oportunidades de producto para conversion

### Demo interactiva

Crear una demo segura con paciente ficticio donde el usuario vea:

- Ficha de paciente.
- Sesion transcrita.
- Chat preguntando al historial.
- Informe generado.
- Test respondido.

Esto vende mejor que explicar tecnicamente la IA.

### Antes y despues

Mostrar:

- Antes: audio, notas sueltas, calendario, documentos, informes manuales.
- Despues: ficha unica, transcripcion, busqueda, informe editable.

### Calculadora de tiempo

Permitir al psicologo ingresar:

- Sesiones por semana.
- Minutos de notas por sesion.
- Informes por mes.

Resultado:

- Horas administrativas estimadas.
- Tiempo potencial recuperable.

Importante: usar `estimado`, no promesa garantizada.

### Checklist de confianza

Mostrar con honestidad:

- Tu decides cuando grabar.
- Requiere consentimiento.
- Puedes editar todo.
- Puedes exportar.
- La IA no diagnostica.

## Priorizacion recomendada antes de venta fuerte

1. Unificar marca: Psiconex vs DatnexiA.
2. Ajustar claims de landing a lo implementado.
3. Agregar consentimiento informado minimo.
4. Definir politica de privacidad y terminos.
5. Validar infraestructura de produccion y pais de hosting.
6. Definir pricing real o mantener CTA de demo.
7. Preparar demo con datos ficticios.
8. Agregar onboarding basico.
9. Definir roadmap publico de tests adicionales.

## Tabla: implementado vs roadmap para marketing

| Tema | Estado | Como comunicar |
|---|---|---|
| Transcripcion presencial | Implementado | Feature principal |
| Separacion de hablantes | Implementado con dependencias | Feature principal, con lenguaje prudente |
| Perfil de voz | Implementado | Diferencial fuerte |
| Chat con historial | Implementado con DeepSeek | Feature principal |
| Informes IA | Implementado con DeepSeek | Feature principal, siempre editable |
| Test Ellis | Implementado | Feature secundaria fuerte |
| Otros tests | No confirmado | Roadmap |
| Agenda | Implementado | Feature principal/secundaria |
| Google Calendar | Implementado con credenciales | Feature con integracion opcional |
| WhatsApp confirmacion | Implementado como mensaje prellenado | Feature secundaria |
| Pagos | No implementado | No vender |
| Consentimiento | No implementado | Requisito/roadmap |
| Seguridad avanzada | Parcial | Hablar con prudencia |
| Clinicas multiusuario | Parcial/basico | Plan futuro o a medida |
| App movil | No implementada | No vender |

## Recomendacion final para marketing

La venta inicial deberia enfocarse en tres promesas:

1. Registrar mejor sin escribir todo desde cero.
2. Preparar sesiones e informes usando el historial real del paciente.
3. Mantener al psicologo en control de cada texto, interpretacion y decision.

Lo demas debe apoyar esa promesa, no distraerla.
