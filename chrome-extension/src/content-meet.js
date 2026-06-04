// Content script para Google Meet — selectores actualizados Junio 2026

const CAPTION_POLL_MS = 1500;

let startTime = Date.now();
let sessionConfigured = false;
let backendUrl = "http://localhost:8000";
let sessionId = null;
let token = null;

// Por cada row visible (key = "índice:speaker") guardamos el último texto
// enviado para no reenviar snapshots idénticos.
const lastSentByRow = new Map();

function timestampSeconds() {
  return Math.round((Date.now() - startTime) / 1000);
}

// Estructura de Meet 2026:
// .nMcdL              → fila de caption (cada turno)
//   .iOzk7            → contiene "SpeakerNameTextoDelCaption" pegado
//     .ygicle.VbkSUe  → solo el texto del caption
function readAllCaptions() {
  const rows = document.querySelectorAll(".nMcdL");
  const out = [];
  rows.forEach((row) => {
    const textEl = row.querySelector(".ygicle, .VbkSUe");
    const text = textEl?.textContent?.trim() || "";
    if (!text) return;
    const fullText = row.textContent?.trim() || "";
    const speaker = fullText.replace(text, "").trim() || "Desconocido";
    out.push({ speaker, text });
  });
  return out;
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
    } else {
      sessionConfigured = false;
      console.log("[DatnexiA] Sin sesión virtual configurada.");
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

function sendChunk(speaker, text) {
  try {
    chrome.runtime.sendMessage({
      type: "CAPTION",
      speaker,
      text,
      timestamp: timestampSeconds(),
    }).catch(() => {});
  } catch (err) {
    if (err.message?.includes("Extension context invalidated")) {
      console.log("[DatnexiA] Extensión recargada — recarga esta pestaña.");
    }
  }
}

function startPolling() {
  setInterval(() => {
    if (!sessionConfigured) return;
    const captions = readAllCaptions();
    if (!captions.length) return;

    // Enviar SIEMPRE el snapshot acumulado de cada row (no deltas). El
    // backend agrupa por ventana y se queda con el chunk más largo →
    // recibe el texto final completo del turno.
    captions.forEach(({ speaker, text }, idx) => {
      const key = `${idx}:${speaker}`;
      if (lastSentByRow.get(key) === text) return;
      lastSentByRow.set(key, text);
      sendChunk(speaker, text);
    });

    // Si ahora hay menos rows que antes, limpiar las claves obsoletas.
    for (const key of lastSentByRow.keys()) {
      const idx = parseInt(key.split(":")[0], 10);
      if (idx >= captions.length) lastSentByRow.delete(key);
    }
  }, CAPTION_POLL_MS);
}

// Flush al cerrar la pestaña: lee el DOM una última vez y dispara fetch
// con keepalive directo al backend, saltándose el service worker (que
// puede tardar en procesar el último mensaje). keepalive permite que el
// request sobreviva al unload.
function flushOnUnload() {
  if (!sessionConfigured || !sessionId || !token) return;
  const captions = readAllCaptions();
  if (!captions.length) return;
  const ts = timestampSeconds();
  const payload = captions.map(({ speaker, text }) => ({
    speaker_name: speaker,
    texto: text,
    timestamp_seconds: ts,
  }));
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
