// Servidor de señalización WebRTC para las videollamadas 1-a-1 de Psiconex.
// Solo retransmite offer/answer/ICE entre el psicólogo y el paciente de una sala.
const crypto = require("crypto");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.SIGNALING_SECRET || "dev-signaling-secret";
const HEARTBEAT_MS = 25000;
const ROLES = new Set(["psicologo", "paciente"]);
const RELAY_TYPES = new Set(["offer", "answer", "ice-candidate", "media-state"]);

// roomId -> { psicologo?: ws, paciente?: ws }
const rooms = new Map();

function send(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function verifyTicket(roomId, ticket) {
  if (typeof ticket !== "string") return false;
  const [exp, signature] = ticket.split(".");
  if (!exp || !signature || Number(exp) * 1000 < Date.now()) return false;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${roomId}:psicologo:${exp}`)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function otherRole(role) {
  return role === "psicologo" ? "paciente" : "psicologo";
}

function leave(ws) {
  const { roomId, role } = ws;
  if (!roomId) return;
  const room = rooms.get(roomId);
  ws.roomId = null;
  if (!room || room[role] !== ws) return;
  delete room[role];
  send(room[otherRole(role)], { type: "peer-disconnected", role });
  if (!room.psicologo && !room.paciente) rooms.delete(roomId);
}

function join(ws, { roomId, role, ticket }) {
  if (typeof roomId !== "string" || !/^[a-f0-9]{16,64}$/.test(roomId) || !ROLES.has(role)) {
    send(ws, { type: "error", code: "invalid-join" });
    return ws.close(4000, "invalid-join");
  }
  if (role === "psicologo" && !verifyTicket(roomId, ticket)) {
    send(ws, { type: "error", code: "unauthorized" });
    return ws.close(4001, "unauthorized");
  }

  const room = rooms.get(roomId) || {};
  const existing = room[role];
  if (existing && existing !== ws) {
    if (role === "psicologo") {
      // Mismo psicólogo autenticado recargando la página: reemplaza la conexión anterior.
      existing.roomId = null;
      send(existing, { type: "replaced" });
      existing.close(4002, "replaced");
    } else if (existing.readyState === WebSocket.OPEN && existing.isAlive) {
      send(ws, { type: "room-full" });
      return ws.close(4003, "room-full");
    } else {
      existing.roomId = null;
      existing.terminate();
    }
  }

  room[role] = ws;
  rooms.set(roomId, room);
  ws.roomId = roomId;
  ws.role = role;

  const peer = room[otherRole(role)];
  send(ws, { type: "joined", role, peerPresent: Boolean(peer) });
  if (peer) {
    send(peer, { type: "peer-joined", role });
    // El psicólogo siempre inicia el offer para evitar colisiones.
    send(room.psicologo, { type: "ready" });
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(req.url === "/health" ? 200 : 404, { "Content-Type": "text/plain" });
  res.end(req.url === "/health" ? "ok" : "not found");
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "join") return join(ws, msg);
    if (msg.type === "leave") return leave(ws);
    if (msg.type === "ping") return send(ws, { type: "pong" });
    if (!RELAY_TYPES.has(msg.type) || !ws.roomId) return;

    const room = rooms.get(ws.roomId);
    const peer = room && room[otherRole(ws.role)];
    send(peer, { type: msg.type, payload: msg.payload, from: ws.role });
  });

  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      leave(ws);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Psiconex signaling escuchando en :${PORT}`);
});
