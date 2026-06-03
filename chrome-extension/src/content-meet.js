// Content script para Google Meet
// Observa el DOM de captions en tiempo real y envía cada entrada al background

const APP_ORIGIN = "http://localhost:3000";
const CAPTION_POLL_MS = 800;

let lastText = "";
let startTime = Date.now();
let initialized = false;

function timestampSeconds() {
  return Math.round((Date.now() - startTime) / 1000);
}

// Intenta leer el speaker y texto del DOM actual de Meet
// Los selectores pueden cambiar con actualizaciones de Meet — son los más estables a 2026
function readCurrentCaption() {
  // Intentar múltiples selectores por si Google actualiza el DOM
  const selectors = [
    { speaker: '[jsname="PzHuGe"]', text: '[jsname="tgaKEf"]' },
    { speaker: ".a4cQT", text: ".iTTPOb" },
    { speaker: '[data-sender-name]', text: '[data-message-text]' },
  ];

  for (const sel of selectors) {
    const speakerEl = document.querySelector(sel.speaker);
    const textEl = document.querySelector(sel.text);
    if (speakerEl && textEl) {
      return {
        speaker: speakerEl.textContent?.trim() || "Desconocido",
        text: textEl.textContent?.trim() || "",
      };
    }
  }
  return null;
}

async function initSession() {
  // Lee la sesión virtual pendiente del localStorage de nuestra app
  // La app almacena el token y session_id cuando el psicólogo crea la sesión
  try {
    const iframe = document.createElement("iframe");
    iframe.src = APP_ORIGIN;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    await new Promise((res) => setTimeout(res, 1500));
    // Usa postMessage para leer localStorage del dominio de la app
    // (cross-origin: la app debe escuchar este mensaje y responder)
    window.addEventListener("message", (ev) => {
      if (ev.origin !== APP_ORIGIN) return;
      if (ev.data?.type === "DATNEXIA_SESSION") {
        const { sessionId, token } = ev.data;
        if (sessionId && token) {
          chrome.runtime.sendMessage({ type: "SET_SESSION", sessionId, token });
          initialized = true;
        }
        document.body.removeChild(iframe);
      }
    }, { once: true });

    iframe.contentWindow?.postMessage({ type: "GET_DATNEXIA_SESSION" }, APP_ORIGIN);
  } catch {
    // Fallback: leer desde chrome.storage si el usuario configuró manualmente
    const stored = await chrome.storage.local.get(["sessionId", "token"]);
    if (stored.sessionId && stored.token) {
      chrome.runtime.sendMessage({ type: "SET_SESSION", sessionId: stored.sessionId, token: stored.token });
      initialized = true;
    }
  }
}

// Polling de captions cada CAPTION_POLL_MS ms
function startPolling() {
  setInterval(() => {
    if (!initialized) return;
    const caption = readCurrentCaption();
    if (!caption || !caption.text || caption.text === lastText) return;
    lastText = caption.text;
    chrome.runtime.sendMessage({
      type: "CAPTION",
      speaker: caption.speaker,
      text: caption.text,
      timestamp: timestampSeconds(),
    });
  }, CAPTION_POLL_MS);
}

// Observa cambios en el DOM para detectar cuándo aparecen los captions
const observer = new MutationObserver(() => {
  if (!initialized) initSession();
});
observer.observe(document.body, { childList: true, subtree: true });

// Intentar inicializar tras carga
setTimeout(() => {
  initSession();
  startPolling();
}, 3000);
