# Reglas Locales del Proyecto (Antigravity)

<RULE[wsl_hot_reload]>
### Sincronización Windows-WSL (Hot-Reload)
El usuario ejecuta sus servidores de desarrollo (ej. `npm run dev`) desde la terminal de WSL (Linux), mientras que el workspace físico reside en Windows. Debido a esto, el *file-watching* (inotify) de WSL no detecta correctamente las escrituras de archivos realizadas por Antigravity desde Windows. 
- **Acción:** Al finalizar una refactorización o edición de código que involucre la UI o servidor local, **recuérdale siempre al usuario** que debe reiniciar su servidor de desarrollo en WSL (`Ctrl+C` y volver a arrancar) para forzar la lectura del disco y ver los cambios reflejados.
- **Acción:** Si el usuario reporta que "no ve los cambios" en el navegador después de una edición, asume inmediatamente que es por este problema de WSL y recomiéndale limpiar la caché del framework y reiniciar. Para Next.js: `rm -rf .next && npm run dev`. No preguntes desde qué entorno se ejecuta — **siempre es WSL**.
- **Restricción:** NUNCA preguntes si el servidor se ejecuta desde WSL o Windows. Siempre asume WSL y da los comandos Linux directamente.
</RULE[wsl_hot_reload]>

<RULE[react_modals_portals]>
### Renderizado de Modales y Dropdowns (React/Next.js)
Cuando crees o corrijas problemas de posicionamiento de modales, cuadros de diálogo (dialogs) o menús flotantes que se corten, no se superpongan correctamente, o aparezcan en posiciones erróneas debido al scroll de la página:
- **Acción:** No intentes solucionar el problema modificando múltiples `z-index` o eliminando restricciones de `overflow` en los contenedores padre, ya que esto suele romper la UI.
- **Acción:** Envuelve el modal problemático utilizando un Portal de React (`createPortal` de `react-dom`) para montarlo directamente en `document.body` (ej. creando un wrapper `<ClientPortal>`), asegurando que escape de cualquier contexto de apilamiento conflictivo.
</RULE[react_modals_portals]>

<RULE[frontend_api_usage]>
### Uso de API en Frontend (apiFetch)
- **Acción:** Al realizar peticiones desde componentes del frontend hacia el backend, debes utilizar estrictamente las utilidades exportadas en `@/lib/api.ts`, específicamente `apiFetch` (para rutas autenticadas) o `publicApiFetch` (para rutas públicas).
- **Restricción:** NUNCA inventes funciones como `apiCall` ni uses `fetch` crudo (a menos que no exista otra opción) para evitar errores de importación y problemas con el refresco de tokens JWT.
- **Manejo de Errores:** Estas funciones retornan un objeto `Response` nativo. Debes validar los errores manualmente usando `if (!res.ok)` y leer el JSON con `await res.json()` para extraer mensajes detallados (`res.json().detail`).
</RULE[frontend_api_usage]>

<RULE[landing_dual_sync]>
### Sincronización de Landing (frontend/ y marketing/)
El repositorio contiene dos proyectos Next.js que comparten secciones públicas de la landing:
- `frontend/`: Corre en `http://localhost:3000` dentro del contenedor Docker de desarrollo.
- `marketing/`: Corre en `http://localhost:3001` (landing independiente de producción).
- **Acción:** Al modificar componentes de la landing (Hero, estilos, videos, assets en `public/`), actualiza e integra los cambios tanto en `marketing/` como en `frontend/` para que el entorno local en `localhost:3000` y la versión de producción queden 100% alineados.
</RULE[landing_dual_sync]>

<RULE[wsl_node_version]>
### Versión de Node en WSL (Next.js 16 / Tailwind v4)
El proyecto `marketing/` utiliza Next.js 16 y dependencias que requieren Node `>=20.9.0` y binarios Linux ARM64.
- **Acción:** Al ejecutar comandos dentro de WSL para `marketing/`, asegúrate de cargar Node 20 (`nvm use 20` o `export PATH="/home/matia/.nvm/versions/node/v20.20.2/bin:$PATH"`).
</RULE[wsl_node_version]>

<RULE[vps_deployment_prerequisites]>
### Prerrequisitos de Despliegue VPS (Psiconex)
Configuración de acceso y seguridad para despliegue en VPS:
- **SSH Host:** `psiconex-vps` configurado con `HostName 72.60.59.142`, `User root`, `IdentityFile ~/.ssh/psiconex_vps_ed25519`, `IdentitiesOnly yes`.
- **Seguridad de Llaves:** La llave privada debe existir localmente y NUNCA incluirse en Git ni en las skills.
- **Remoto Git:** El repositorio debe tener el remoto `vps` apuntando a `ssh://psiconex-vps/srv/psiconex-docker/repository.git`.
- **Secretos:** NUNCA exponer los valores de `.env.production` ni del `.env` compartido de la VPS en commits, logs o respuestas.
- **Marketing Build:** Limpiar `.next` antes de compilar para evitar HTML estático obsoleto.
</RULE[vps_deployment_prerequisites]>

<RULE[acceso_autonomo]>
### Acceso Completo y Ejecución Autónoma (Local y Global)
- **Ejecución 100% Autónoma y Continua**: Trabajar de principio a fin sin pedir confirmaciones intermedias, autorizaciones de terminal ni permisos redundantes al usuario.
- **Acceso a Archivos y Terminal**: Acceso total y pre-aprobado a todas las rutas, archivos de entorno, comandos de PowerShell, WSL y SSH requeridos para cumplir los objetivos.
</RULE[acceso_autonomo]>


