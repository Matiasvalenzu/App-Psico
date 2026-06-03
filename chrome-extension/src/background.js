// Estado de la sesión activa
let state = {
  sessionId: null,
  token: null,
  backendUrl: "http://localhost:8000",
  buffer: [],
  sending: false,
};

// Carga configuración desde storage
async function loadState() {
  const stored = await chrome.storage.local.get(["backendUrl"]);
  if (stored.backendUrl) state.backendUrl = stored.backendUrl;
}

// Recibe captions desde los content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CAPTION") {
    if (!state.sessionId || !state.token) {
      sendResponse({ ok: false, reason: "no_session" });
      return;
    }
    state.buffer.push({
      speaker_name: msg.speaker,
      texto: msg.text,
      timestamp_seconds: msg.timestamp,
    });
    sendResponse({ ok: true });
  }

  if (msg.type === "SET_SESSION") {
    state.sessionId = msg.sessionId;
    state.token = msg.token;
    state.buffer = [];
    sendResponse({ ok: true });
  }

  if (msg.type === "GET_STATUS") {
    sendResponse({
      sessionId: state.sessionId,
      buffered: state.buffer.length,
      backendUrl: state.backendUrl,
    });
  }

  if (msg.type === "SET_BACKEND_URL") {
    state.backendUrl = msg.url;
    chrome.storage.local.set({ backendUrl: msg.url });
    sendResponse({ ok: true });
  }

  return true;
});

// Envía el buffer al backend cada 3 segundos
async function flushBuffer() {
  if (state.sending || !state.sessionId || !state.token || !state.buffer.length) return;
  state.sending = true;
  const toSend = state.buffer.splice(0, state.buffer.length);
  try {
    await fetch(`${state.backendUrl}/api/sesiones/${state.sessionId}/caption/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(toSend),
    });
  } catch {
    // Si falla, devuelve los chunks al buffer para reintentar
    state.buffer.unshift(...toSend);
  } finally {
    state.sending = false;
  }
}

// Alarm para flush periódico
chrome.alarms.create("flush", { periodInMinutes: 0.05 }); // ~3 segundos
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flushBuffer();
});

loadState();
