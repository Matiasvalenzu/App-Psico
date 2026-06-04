// Content script para Google Meet — selectores actualizados Junio 2026

const CAPTION_POLL_MS = 1500;

let lastText = "";
let lastSpeaker = "";
let startTime = Date.now();
let sessionConfigured = false;

function timestampSeconds() {
  return Math.round((Date.now() - startTime) / 1000);
}

// Estructura de Meet 2026:
// .nMcdL              → fila de caption (cada turno)
//   .iOzk7            → contiene "SpeakerNameTextoDelCaption" pegado
//     .ygicle.VbkSUe  → solo el texto del caption
function readCurrentCaption() {
  const rows = document.querySelectorAll(".nMcdL");
  if (!rows.length) return null;

  const lastRow = rows[rows.length - 1];
  const textEl = lastRow.querySelector(".ygicle, .VbkSUe");
  const text = textEl?.textContent?.trim() || "";
  if (!text) return null;

  // El speaker es lo que está en el row pero NO en el .ygicle
  const fullText = lastRow.textContent?.trim() || "";
  const speaker = fullText.replace(text, "").trim() || "Desconocido";

  return { speaker, text };
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
      console.log("[DatnexiA] Sin sesión virtual configurada.");
    }
  } catch (err) {
    console.warn("[DatnexiA] Error cargando sesión:", err);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.sessionId || changes.token)) {
    loadSessionFromStorage();
  }
});

function startPolling() {
  const pollId = setInterval(() => {
    if (!sessionConfigured) return;
    const caption = readCurrentCaption();
    if (!caption) return;

    let toSend = "";
    if (caption.speaker !== lastSpeaker) {
      // Speaker cambió: enviar el texto completo del nuevo turno
      toSend = caption.text;
    } else if (caption.text.startsWith(lastText) && lastText) {
      // Mismo speaker, texto creció: enviar solo el delta nuevo
      toSend = caption.text.substring(lastText.length).trim();
    } else if (caption.text !== lastText) {
      // Caption distinto (corregido o nuevo): enviar todo
      toSend = caption.text;
    }

    if (!toSend) return;

    lastText = caption.text;
    lastSpeaker = caption.speaker;

    try {
      chrome.runtime.sendMessage({
        type: "CAPTION",
        speaker: caption.speaker,
        text: toSend,
        timestamp: timestampSeconds(),
      }).catch(() => {});
    } catch (err) {
      if (err.message?.includes("Extension context invalidated")) {
        clearInterval(pollId);
        console.log("[DatnexiA] Extensión recargada — recarga esta pestaña.");
      }
    }
  }, CAPTION_POLL_MS);
}

loadSessionFromStorage().then(startPolling);
