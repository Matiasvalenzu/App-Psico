// Content script para Zoom Web Client — versión ligera

const CAPTION_POLL_MS = 1500;

let lastText = "";
let startTime = Date.now();
let sessionConfigured = false;
let backendUrl = "http://localhost:8000";
let sessionId = null;
let token = null;

function timestampSeconds() {
  return Math.round((Date.now() - startTime) / 1000);
}

function readCurrentCaption() {
  const selectors = [
    { speaker: ".transcript-participant__name", text: ".transcript-participant__utterance" },
    { speaker: ".zmu-txt--body", text: ".zmWebApp__caption" },
    { speaker: '[class*="speaker-name"]', text: '[class*="caption-text"]' },
  ];

  for (const sel of selectors) {
    const speakerEls = document.querySelectorAll(sel.speaker);
    const textEls = document.querySelectorAll(sel.text);
    if (speakerEls.length && textEls.length) {
      const text = textEls[textEls.length - 1].textContent?.trim() || "";
      if (text) {
        return {
          speaker: speakerEls[speakerEls.length - 1].textContent?.trim() || "Desconocido",
          text,
        };
      }
    }
  }
  return null;
}

async function loadSessionFromStorage() {
  try {
    const stored = await chrome.storage.local.get(["sessionId", "token", "backendUrl"]);
    if (stored.backendUrl) backendUrl = stored.backendUrl;
    if (stored.sessionId && stored.token) {
      sessionId = stored.sessionId;
      token = stored.token;
      await chrome.runtime.sendMessage({
        type: "SET_SESSION",
        sessionId,
        token,
      });
      sessionConfigured = true;
      console.log("[DatnexiA] Sesión virtual cargada:", sessionId);
    }
  } catch (err) {
    console.warn("[DatnexiA] Error cargando sesión:", err);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.sessionId || changes.token || changes.backendUrl)) {
    loadSessionFromStorage();
  }
});

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

// Flush al cerrar la pestaña — fetch keepalive sobrevive al unload.
function flushOnUnload() {
  if (!sessionConfigured || !sessionId || !token) return;
  const caption = readCurrentCaption();
  if (!caption) return;
  const payload = [{
    speaker_name: caption.speaker,
    texto: caption.text,
    timestamp_seconds: timestampSeconds(),
  }];
  try {
    fetch(`${backendUrl}/api/sesiones/${sessionId}/caption/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch (err) {
    console.warn("[DatnexiA] Error en flushOnUnload:", err);
  }
}

window.addEventListener("pagehide", flushOnUnload);
window.addEventListener("beforeunload", flushOnUnload);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushOnUnload();
});

loadSessionFromStorage().then(startPolling);
