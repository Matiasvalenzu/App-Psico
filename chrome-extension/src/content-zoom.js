// Content script para Zoom Web Client
// Observa el panel de transcripción en tiempo real

const APP_ORIGIN = "http://localhost:3000";
const CAPTION_POLL_MS = 800;

let lastText = "";
let startTime = Date.now();
let initialized = false;

function timestampSeconds() {
  return Math.round((Date.now() - startTime) / 1000);
}

function readCurrentCaption() {
  // Selectores del cliente web de Zoom (zoom.us/wc/)
  const selectors = [
    { speaker: ".transcript-participant__name", text: ".transcript-participant__utterance" },
    { speaker: ".zmu-txt--body", text: ".zmWebApp__caption" },
    { speaker: '[class*="speaker-name"]', text: '[class*="caption-text"]' },
  ];

  for (const sel of selectors) {
    const speakerEls = document.querySelectorAll(sel.speaker);
    const textEls = document.querySelectorAll(sel.text);
    if (speakerEls.length && textEls.length) {
      const lastSpeaker = speakerEls[speakerEls.length - 1];
      const lastText = textEls[textEls.length - 1];
      return {
        speaker: lastSpeaker.textContent?.trim() || "Desconocido",
        text: lastText.textContent?.trim() || "",
      };
    }
  }
  return null;
}

async function initSession() {
  try {
    const stored = await chrome.storage.local.get(["sessionId", "token"]);
    if (stored.sessionId && stored.token) {
      chrome.runtime.sendMessage({ type: "SET_SESSION", sessionId: stored.sessionId, token: stored.token });
      initialized = true;
    }
  } catch {}
}

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

const observer = new MutationObserver(() => {
  if (!initialized) initSession();
});
observer.observe(document.body, { childList: true, subtree: true });

setTimeout(() => {
  initSession();
  startPolling();
}, 3000);
