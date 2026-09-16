---
name: agentes-personalizados
description: Guía completa y especificación para crear, configurar y utilizar Agentes Personalizados (Custom Agents y Asynchronous Subagents) en Antigravity 2.0 y CLI. Utilízala siempre que el usuario solicite crear, modificar, auditar o invocar agentes o subagentes personalizados en este proyecto.
---

# Agentes Personalizados (Custom Agents) en Antigravity

Los **Agentes Personalizados** permiten definir roles especializados mediante archivos Markdown con encabezado YAML frontmatter. Resuelven la falta de especialización de los asistentes genéricos y evitan la saturación de la ventana de contexto (*context window bloat*), permitiendo que cada agente opere con un conjunto acotado de instrucciones, herramientas, modelos y permisos.

---

## 1. Ubicación y Descubrimiento (Dónde se guardan)

Antigravity descubre automáticamente los agentes buscando archivos `.md` en las siguientes rutas (orden de precedencia jerárquico):

| Ámbito | Ruta | Descripción |
| :--- | :--- | :--- |
| **Proyecto / Workspace** (Recomendado) | `.agents/agents/<nombre>.md`<br>o `.agents/agents/<nombre>/agent.md` | Específico del repositorio. Al commitearse en Git, queda disponible automáticamente para todo el equipo sin configuración manual. |
| **Global de Usuario** | `~/.gemini/config/agents/<nombre>.md`<br>o `~/.gemini/config/agents/<nombre>/agent.md` | Disponible en todos los proyectos y carpetas de la máquina del usuario. |
| **Plugins empaquetados** | `plugins/<plugin_name>/agents/` | Agentes empaquetados y distribuidos dentro de un plugin. |

> [!IMPORTANT]
> Para este proyecto, los agentes deben guardarse en `.agents/agents/<nombre>.md` para mantenerlos versionados en el repositorio sin afectar la configuración global del sistema.

---

## 2. Formato de Archivo y Campos Frontmatter (YAML)

Un agente personalizado se compone de:
1. **Frontmatter YAML**: Metadatos, herramientas permitidas, modelo, políticas de ejecución y flags de invocación.
2. **Cuerpo Markdown**: System prompt e instrucciones base que se compilan directamente en el contexto del agente.

### Tabla de Campos Soportados

| Campo | Tipo | Obligatorio / Default | Descripción |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Requerido** | Identificador único del agente (usar kebab-case, ej. `dependency-modernizer`, `code-auditor`). |
| `description` | `string` | **Requerido** | Descripción detallada del rol. El planificador y los agentes coordinadores la usan para decidir cuándo delegarle tareas. |
| `tools` | `string[]` | Opcional (`[]`) | Lista explícita de herramientas permitidas (ej. `view_file`, `replace_file_content`, `run_command`, `grep_search`, `manage_task`). Solo las herramientas listadas estarán accesibles. |
| `mainAgent` | `boolean` | Opcional (`true`) | Si es `true`, el agente se puede seleccionar directamente como agente principal en el dropdown de la interfaz de Antigravity 2.0 o invocarse vía CLI (`agy --agent <name>`). |
| `subagent` | `boolean` | Opcional (`true`) | Si es `true`, permite que un agente coordinador lo invoque dinámicamente en segundo plano mediante la herramienta `invoke_subagent`. |
| `model` | `string` | Opcional (`inherit`) | Nivel de modelo asignado al agente: `inherit` (hereda del padre), `flash` (rápido/económico), `pro` (razonamiento estándar/avanzado) o `ultra`. |
| `commandExecutionPolicy`| `string` | Opcional (`sandbox`) | Política de auto-ejecución de comandos de terminal: `off`, `auto`, `eager` o `sandbox`. Con `auto`, ejecuta tests y builds de forma autónoma pero frena comandos de riesgo. |
| `permissionMode` | `string` | Opcional | Modo de permisos (ej. `acceptEdits`, `bypassPermissions`). |
| `skills` | `string[]` | Opcional (`[]`) | Rutas de habilidades curadas a las que tendrá acceso el agente (ej. `skills/security-checklist` o `.agents/skills/psiconex-vps-deploy`). Evita inyectar skills irrelevantes. |
| `plugins` | `string[]` | Opcional (`[]`) | Lista de dependencias de plugins requeridas por el agente. |
| `mcpServers` | `object[]` | Opcional (`[]`) | Servidores MCP específicos aprovisionados para este agente. |

> [!WARNING]
> **Atención con nombres de herramientas en `tools`**: Especificar un nombre de herramienta inexistente o con error tipográfico (typo) puede causar que el proceso del subagente se bloquee o quede colgado durante la ejecución. Verifica siempre la ortografía exacta (ej. `view_file`, `replace_file_content`, `multi_replace_file_content`, `run_command`, `grep_search`, `list_dir`).

---

## 3. Estructura del Cuerpo Markdown (System Prompt)

El contenido posterior al delimitador `---` se convierte en el prompt de sistema del agente. Se recomienda estructurarlo con encabezados Markdown claros:

```markdown
---
name: nombre-del-agente
description: Descripción de cuándo invocar o delegar a este agente.
tools:
  - view_file
  - grep_search
model: flash
mainAgent: true
subagent: true
---
# Propósito y Rol
Explicación concisa de la función del agente.

# Instrucciones Principales
Pasos detallados que el agente debe seguir ante una tarea.

# Directivas y Restricciones
Límites operativos, reglas de seguridad y qué acciones NO debe realizar.
```

---

## 4. Cómo se Invocan y Ejecutan los Agentes

Antigravity implementa **simetría de ejecución**, lo que significa que el mismo agente puede actuar como agente principal o como subagente según las banderas `mainAgent` y `subagent`:

### A. Como Agente Principal (Main Agent)
- **Interfaz Gráfica (Antigravity 2.0 / IDE)**: Se selecciona directamente desde el menú desplegable de selección de agentes en el panel de chat.
- **Terminal (Antigravity CLI)**: Se arranca directamente pasando el parámetro `--agent`:
  ```bash
  agy --agent nombre-del-agente
  ```
- Al iniciar como Main Agent, sus instrucciones del Markdown se compilan directamente en el prompt del sistema y se aplican sus herramientas y modelo configurados.

### B. Como Subagente Asíncrono (Subagent)
Un agente coordinador o padre delega trabajo al subagente mediante la llamada a la herramienta:
- **Herramienta**: `invoke_subagent`
- **Aislamiento de contexto**: El subagente inicia con una ventana de contexto limpia (no hereda el historial conversacional del padre), ahorrando tokens y evitando confusiones.
- **Modos de Workspace**:
  - `inherit`: Trabaja sobre el mismo espacio de trabajo del padre.
  - `branch`: Crea y trabaja sobre un Git worktree aislado.
  - `share`: Comparte almacenamiento de directorio.
- **Subagentes transitorios**: También se pueden crear agentes al vuelo durante una conversación usando `define_subagent`.

### C. Ciclo de Vida y Comunicación Entre Agentes
1. **Running (En ejecución)**: El subagente procesa su tarea de forma asíncrona en segundo plano. Se puede inspeccionar su progreso en la UI o CLI (`Alt+J`) y detenerlo si es necesario (`k` o botón *Stop Subagent*).
2. **Idle (En espera)**: Tras enviar su resultado al agente padre, el subagente se pausa. Si cualquier agente le envía un nuevo mensaje usando su ID de conversación, se despierta automáticamente (**Auto-Wake**) conservando su contexto acumulado.
3. **Killed (Terminado)**: Finalización definitiva. Se limpian los worktrees temporales y el registro permanece en los logs JSONL.
4. **Límites de Anidamiento**: Antigravity impone un límite estricto de **10 niveles de profundidad** de subagentes para evitar recursión descontrolada.
5. **Burbujeo de Permisos**: Si un subagente necesita ejecutar una acción que requiera autorización humana, la solicitud sube automáticamente a la interfaz principal.

---

## 5. Plantillas de Ejemplo

### Ejemplo 1: Auditor de Código y Seguridad (`code-auditor.md`)
Ubicación: `.agents/agents/code-auditor.md`
```markdown
---
name: code-auditor
description: Subagente especializado en auditorías de seguridad, análisis estático de vulnerabilidades y revisión de buenas prácticas.
tools:
  - view_file
  - grep_search
  - list_dir
model: pro
mainAgent: true
subagent: true
commandExecutionPolicy: sandbox
---
# Propósito
Eres un auditor de seguridad y revisor de código senior. Tu misión es examinar código fuente en busca de vulnerabilidades, fuga de secretos, inyecciones y malas prácticas arquitectónicas.

# Reglas de Auditoría
1. Analiza archivos sin modificarlos (modo de solo lectura).
2. Señala con precisión línea, causa raíz y severidad (Baja, Media, Alta, Crítica).
3. Propón la remediación concreta con ejemplos de código seguro.
```

### Ejemplo 2: Actualizador de Dependencias (`dependency-modernizer.md`)
Ubicación: `.agents/agents/dependency-modernizer.md`
```markdown
---
name: dependency-modernizer
description: Actualiza paquetes y dependencias del proyecto y valida que los tests y compilación sigan pasando.
tools:
  - view_file
  - replace_file_content
  - multi_replace_file_content
  - run_command
  - manage_task
model: flash
mainAgent: true
subagent: true
commandExecutionPolicy: auto
---
# Rol
Eres un asistente encargado de modernizar dependencias de proyectos (npm, pip, cargo, etc.).

# Flujo de Trabajo
1. Revisa los archivos de configuración de dependencias (`package.json`, `requirements.txt`, etc.).
2. Identifica versiones obsoletas o paquetes con avisos de vulnerabilidad.
3. Ejecuta comandos de actualización controlada.
4. Ejecuta la suite de pruebas del proyecto (`run_command`) y verifica que compile sin errores antes de confirmar el cambio.
```

---

## 6. Procedimiento para Crear un Agente en este Proyecto

1. Crear la carpeta `.agents/agents/` si aún no existe:
   ```bash
   mkdir -p .agents/agents
   ```
2. Crear un archivo `<nombre-del-agente>.md` dentro de `.agents/agents/`.
3. Escribir el encabezado YAML delimitado por `---` con los campos requeridos (`name`, `description`) y opcionales (`tools`, `model`, `mainAgent`, `subagent`, `commandExecutionPolicy`).
4. Definir las instrucciones y reglas del rol en el cuerpo Markdown.
5. Guardar el archivo y añadirlo al control de versiones (`git add .agents/agents/<nombre-del-agente>.md`).
