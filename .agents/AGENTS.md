# Reglas Locales del Proyecto (Antigravity)

<RULE[wsl_hot_reload]>
### Sincronización Windows-WSL (Hot-Reload)
El usuario ejecuta sus servidores de desarrollo (ej. `npm run dev`) desde la terminal de WSL (Linux), mientras que el workspace físico reside en Windows. Debido a esto, el *file-watching* (inotify) de WSL no detecta correctamente las escrituras de archivos realizadas por Antigravity desde Windows. 
- **Acción:** Al finalizar una refactorización o edición de código que involucre la UI o servidor local, **recuérdale siempre al usuario** de forma proactiva que debe reiniciar su servidor de desarrollo en WSL (`Ctrl+C` y volver a arrancar) para forzar la lectura del disco y ver los cambios reflejados.
- **Acción:** Si el usuario reporta que "no ve los cambios" en el navegador después de una edición, asume inmediatamente que es por este problema de WSL y recomiéndale reiniciar el servidor.
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
