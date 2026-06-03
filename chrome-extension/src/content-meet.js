// Content script para Google Meet — versión ligera (sin MutationObserver agresivo)

const CAPTION_POLL_MS = 1500;

let lastText = "";
let startTime = Date.now();
let sessionConfigured = false;

function timestampSeconds() {
  return Math.round((Date.now() - startTime) / 1000);
}

function readCurrentCaption() {
  // Selectores conocidos de Google Meet (orden de prioridad)
  const selectors = [
    { speaker: '[jsname="PzHuGe"]', text: '[jsname="tgaKEf"]' },
    { speaker: ".a4cQT", text: ".iTTPOb" },
    { speaker: "[data-sender-name]", text: "[data-message-text]" },
  ];

  for (const sel of selectors) {
    const speakerEl = document.querySelector(sel.speaker);
    const textEl = document.querySelector(sel.text);
    if (speakerEl && textEl) {
      const text = textEl.textContent?.trim() || "";
      if (text) {
        return {
          speaker: speakerEl.textContent?.trim() || "Desconocido",
          text,
        };
      }
    }
  }
  return null;
}

async function loadSessionFromStorage() {
  try {
    const stored = await chrome.storage.local.get(["sessionId", "token"]);
    if (stored.sessionId && stored.token) {
      await chrome.runtime.sendMessage({
        type: "SET_SESSION",
        sessionId: stored.sessionId,
        token: stored.token,
      });
      sessionConfigured = true;
      console.log("[DatnexiA] Sesión virtual cargada:", stored.sessionId);
    } else {
      console.log("[DatnexiA] Sin sesión virtual configurada. Abre el popup para configurarla.");
    }
  } catch (err) {
    console.warn("[DatnexiA] Error cargando sesión:", err);
  }
}

// Re-leer storage cuando cambie (cuando el popup actualice los valores)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.sessionId || changes.token)) {
    loadSessionFromStorage();
  }
});

// Polling ligero — solo si hay sesión configurada
function startPolling() {
  setInterval(() => {
    if (!sessionConfigured) return;
    const caption = readCurrentCaption();
    if (!caption || caption.text === lastText) return;
    lastText = caption.text;
    chrome.runtime.sendMessage({
      type: "CAPTION",
      speaker: caption.speaker,
      text: caption.text,
      timestamp: timestampSeconds(),
    }).catch(() => {});
  }, CAPTION_POLL_MS);
}

// Inicialización única, sin observadores agresivos
loadSessionFromStorage().then(startPolling);
