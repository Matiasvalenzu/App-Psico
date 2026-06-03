// Content script que corre en la app DatnexiA (localhost:3000)
// Lee sessionStorage / localStorage y los sincroniza a chrome.storage para que
// los content scripts de Meet/Zoom puedan usarlos automáticamente.

function syncSessionToExtension() {
  const sessionId = sessionStorage.getItem("virtual_session_id");
  const token = localStorage.getItem("access_token");

  if (sessionId && token) {
    chrome.storage.local.set({
      sessionId: parseInt(sessionId),
      token,
    });
  }
}

// Sincronizar al cargar
syncSessionToExtension();

// Re-sincronizar cuando cambie storage de la app (cada 3s, ligero)
setInterval(syncSessionToExtension, 3000);
