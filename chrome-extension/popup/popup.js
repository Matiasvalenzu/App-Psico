const statusEl = document.getElementById("status");
const counterEl = document.getElementById("counter");
const countEl = document.getElementById("count");
const backendUrlInput = document.getElementById("backendUrl");
const sessionIdInput = document.getElementById("sessionId");
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("saveBtn");

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  backendUrlInput.value = res.backendUrl || "http://localhost:8000";

  if (res.sessionId) {
    statusEl.className = "status active";
    statusEl.textContent = `Sesión #${res.sessionId} activa`;
    counterEl.style.display = "block";
    countEl.textContent = res.buffered;
  } else {
    statusEl.className = "status inactive";
    statusEl.textContent = "Sin sesión activa";
    counterEl.style.display = "none";
  }
}

saveBtn.addEventListener("click", async () => {
  const url = backendUrlInput.value.trim().replace(/\/$/, "");
  const sessionId = sessionIdInput.value.trim();
  const token = tokenInput.value.trim();

  if (url) {
    await chrome.runtime.sendMessage({ type: "SET_BACKEND_URL", url });
    // También guardar para que los content scripts lo usen
    await chrome.storage.local.set({ backendUrl: url });
  }

  if (sessionId && token) {
    await chrome.runtime.sendMessage({ type: "SET_SESSION", sessionId: parseInt(sessionId), token });
    await chrome.storage.local.set({ sessionId: parseInt(sessionId), token });
  }

  await refresh();
});

// Actualizar estado cada 2 segundos mientras el popup está abierto
refresh();
setInterval(refresh, 2000);
