// Estado de la sesión activa
let state = {
  sessionId: null,
  token: null,
  backendUrl: "http://localhost:8000",
  buffer: [],
  sending: false,
};

let stateReady = false;

// Carga configuración + buffer persistido desde storage. El buffer se
// rehidrata para que el SW pueda morirse entre flushes sin perder chunks.
async function loadState() {
  const stored = await chrome.storage.local.get([
    "backendUrl",
    "sessionId",
    "token",
    "captionBuffer",
  ]);
  if (stored.backendUrl) state.backendUrl = stored.backendUrl;
  if (stored.sessionId) state.sessionId = stored.sessionId;
  if (stored.token) state.token = stored.token;
  if (Array.isArray(stored.captionBuffer)) state.buffer = stored.captionBuffer;
  stateReady = true;
}

async function persistBuffer() {
  try {
    await chrome.storage.local.set({ captionBuffer: state.buffer });
  } catch {
    // storage puede fallar si el SW se está apagando — el próximo flush
    // lo reintentará.
  }
}

// Recibe captions desde los content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handle = async () => {
    if (!stateReady) await loadState();

    if (msg.type === "CAPTION") {
      if (!state.sessionId || !state.token) {
        console.warn("[DatnexiA] Caption recibido sin sesión configurada — descartado.");
        sendResponse({ ok: false, reason: "no_session" });
        return;
      }
      console.log(`[DatnexiA] CAPTION (${msg.speaker}): "${(msg.text || "").slice(0, 60)}"`);
      state.buffer.push({
        speaker_name: msg.speaker,
        texto: msg.text,
        timestamp_seconds: msg.timestamp,
      });
      await persistBuffer();
      sendResponse({ ok: true });
      // Trigger flush con debounce — no esperar al alarm (que Chrome MV3
      // puede throttlear a 30s).
      scheduleImmediateFlush();
      return;
    }

    if (msg.type === "SET_SESSION") {
      state.sessionId = msg.sessionId;
      state.token = msg.token;
      state.buffer = [];
      await persistBuffer();
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "GET_STATUS") {
      sendResponse({
        sessionId: state.sessionId,
        buffered: state.buffer.length,
        backendUrl: state.backendUrl,
      });
      return;
    }

    if (msg.type === "SET_BACKEND_URL") {
      state.backendUrl = msg.url;
      chrome.storage.local.set({ backendUrl: msg.url });
      sendResponse({ ok: true });
      return;
    }
  };

  handle();
  return true;
});

// Debounce de flush — si llega un caption nuevo dentro de la ventana,
// reinicia el temporizador. Garantiza que no esperamos al alarm.
let flushTimerId = null;
function scheduleImmediateFlush() {
  if (flushTimerId) clearTimeout(flushTimerId);
  flushTimerId = setTimeout(() => {
    flushTimerId = null;
    flushBuffer();
  }, 1500);
}

// Envía el buffer al backend cada segundo
async function flushBuffer() {
  if (!stateReady) await loadState();
  if (state.sending || !state.sessionId || !state.token || !state.buffer.length) return;
  state.sending = true;
  const toSend = state.buffer.splice(0, state.buffer.length);
  await persistBuffer();
  try {
    const res = await fetch(`${state.backendUrl}/api/sesiones/${state.sessionId}/caption/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(toSend),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[DatnexiA] Backend rechazó captions:", res.status, body);
      state.buffer.unshift(...toSend);
      await persistBuffer();
    } else {
      console.log(`[DatnexiA] Flush OK — ${toSend.length} chunks → sesión ${state.sessionId}`);
    }
  } catch (err) {
    console.warn("[DatnexiA] Error de red flusheando:", err);
    state.buffer.unshift(...toSend);
    await persistBuffer();
  } finally {
    state.sending = false;
  }
}

// Flush cada segundo (Chrome 117+ permite intervalos menores a 1 min)
chrome.alarms.create("flush", { periodInMinutes: 1 / 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flushBuffer();
});

loadState();
