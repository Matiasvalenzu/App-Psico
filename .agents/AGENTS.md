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
