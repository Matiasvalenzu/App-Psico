// Content script que corre en la app DatnexiA (localhost:3000)
// Sincroniza sessionStorage / localStorage a chrome.storage para que la
// extensión Meet/Zoom tome el session_id y token automáticamente.

let intervalId = null;

function syncSessionToExtension() {
  try {
    const sessionId = sessionStorage.getItem("virtual_session_id");
    const token = localStorage.getItem("access_token");

    if (sessionId && token) {
      chrome.storage.local.set({
        sessionId: parseInt(sessionId),
        token,
      });
    }
  } catch (err) {
    // "Extension context invalidated" → la extensión se recargó, este content
    // script viejo ya no sirve. Detener el polling para no spamear errores.
    if (err.message?.includes("Extension context invalidated")) {
      if (intervalId) clearInterval(intervalId);
      console.log("[DatnexiA] Extensión recargada — recarga esta pestaña para reconectar.");
    }
  }
}

syncSessionToExtension();
intervalId = setInterval(syncSessionToExtension, 3000);
