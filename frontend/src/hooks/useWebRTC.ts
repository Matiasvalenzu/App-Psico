"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fondoPorId, guardarFondo, leerFondoGuardado, type FondoId } from "@/lib/fondo-videollamada";
import { crearProcesadorFondo, fondosSoportados, type ProcesadorFondo } from "@/lib/fondo-procesador";

export type SalaRole = "psicologo" | "paciente";
export type SalaStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "reconnecting"
  | "room-full"
  | "unauthorized"
  | "replaced"
  | "left";

interface UseWebRTCOptions {
  token: string;
  role: SalaRole;
  ticket?: string;
}

const TERMINAL: SalaStatus[] = ["room-full", "unauthorized", "replaced", "left"];

// Sin NEXT_PUBLIC_TURN_URL solo hay STUN: no se usa ningún relay público por defecto.
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turnUrls = (process.env.NEXT_PUBLIC_TURN_URL || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
      credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || "",
    });
  }
  return servers;
}

function getSignalingUrl(): string {
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) return process.env.NEXT_PUBLIC_SIGNALING_URL;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/signaling/`;
}

export async function getLocalMedia(): Promise<MediaStream> {
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio,
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch {
    // Sin cámara disponible: continuar solo con audio
    return navigator.mediaDevices.getUserMedia({ audio, video: false });
  }
}

export function useWebRTC({ token, role, ticket }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<SalaStatus>("idle");
  const [peerPresent, setPeerPresent] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remoteMedia, setRemoteMedia] = useState({ mic: true, cam: true });
  // Vista propia: audio + la pista que realmente se envía (con fondo si hay efecto)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [fondo, setFondo] = useState<FondoId>("ninguno");
  const [fondoCargando, setFondoCargando] = useState(false);
  const [fondoAviso, setFondoAviso] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const earlyCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const statusRef = useRef<SalaStatus>("idle");
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStateRef = useRef({ mic: true, cam: true });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const procesadorRef = useRef<ProcesadorFondo | null>(null);
  const fondoPedidoRef = useRef<FondoId>("ninguno");
  const aplicarFondoRef = useRef<(id: FondoId) => Promise<void>>(async () => {});

  // Pista de video que se envía: pantalla compartida > cámara con efecto > cámara
  const outgoingVideo = useCallback((): MediaStreamTrack | null => {
    return (
      screenTrackRef.current ||
      procesadorRef.current?.track ||
      localStreamRef.current?.getVideoTracks()[0] ||
      null
    );
  }, []);

  const refreshPreview = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return setPreviewStream(null);
    const video = procesadorRef.current?.track || stream.getVideoTracks()[0];
    setPreviewStream(new MediaStream([...stream.getAudioTracks(), ...(video ? [video] : [])]));
  }, []);

  const updateStatus = useCallback((s: SalaStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const sendMediaState = useCallback(() => {
    send({ type: "media-state", payload: mediaStateRef.current });
  }, [send]);

  const closePeer = useCallback(() => {
    const pc = pcRef.current;
    pcRef.current = null;
    earlyCandidatesRef.current = [];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    setRemoteStream(null);
  }, []);

  const createPeer = useCallback(() => {
    closePeer();
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));
      const videoTrack = outgoingVideo();
      if (videoTrack) pc.addTrack(videoTrack, stream);
    }
    // Quien ofrece siempre negocia video, aunque no tenga cámara, para poder recibir la del otro
    if (role === "psicologo" && pc.getTransceivers().every((t) => t.receiver.track?.kind !== "video")) {
      pc.addTransceiver("video", { direction: "sendrecv" });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice-candidate", payload: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const remote = e.streams[0] || new MediaStream([e.track]);
      // Nuevo objeto para que React y el grabador detecten el cambio
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    const handleReconnect = () => {
      updateStatus("reconnecting");
      // Solo el psicólogo reintenta, y nunca con una negociación en curso
      if (role === "psicologo" && pc.signalingState === "stable") {
        pc.createOffer({ iceRestart: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => send({ type: "offer", payload: { ...pc.localDescription!.toJSON(), iceRestart: true } }))
          .catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === "connected") {
        updateStatus("connected");
        sendMediaState();
      } else if (pc.connectionState === "disconnected") {
        // Suele ser transitorio: el navegador se recupera solo o pasa a "failed"
        updateStatus("reconnecting");
      } else if (pc.connectionState === "failed") {
        handleReconnect();
      }
    };
    return pc;
  }, [closePeer, outgoingVideo, role, send, sendMediaState, updateStatus]);

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queued = earlyCandidatesRef.current;
    earlyCandidatesRef.current = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {}
    }
  }, []);

  const makeOffer = useCallback(async () => {
    const pc = createPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", payload: pc.localDescription });
  }, [createPeer, send]);

  const handleMessage = useCallback(
    async (msg: any) => {
      switch (msg.type) {
        case "joined":
          retryRef.current = 0;
          setPeerPresent(Boolean(msg.peerPresent));
          if (statusRef.current !== "connected") updateStatus("waiting");
          break;
        case "peer-joined":
          setPeerPresent(true);
          break;
        case "ready":
          if (role === "psicologo") await makeOffer();
          break;
        case "offer": {
          if (role !== "paciente") return;
          const current = pcRef.current;
          const pc =
            msg.payload?.iceRestart && current && current.connectionState !== "closed" ? current : createPeer();
          await pc.setRemoteDescription({ type: msg.payload.type, sdp: msg.payload.sdp });
          await flushCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: "answer", payload: pc.localDescription });
          break;
        }
        case "answer": {
          const pc = pcRef.current;
          if (!pc || role !== "psicologo") return;
          await pc.setRemoteDescription(msg.payload);
          await flushCandidates(pc);
          break;
        }
        case "ice-candidate": {
          const pc = pcRef.current;
          if (!pc || !pc.remoteDescription) {
            earlyCandidatesRef.current.push(msg.payload);
            return;
          }
          try {
            await pc.addIceCandidate(msg.payload);
          } catch {}
          break;
        }
        case "media-state":
          if (msg.payload) setRemoteMedia({ mic: msg.payload.mic !== false, cam: msg.payload.cam !== false });
          break;
        case "peer-disconnected":
          setPeerPresent(false);
          closePeer();
          setRemoteMedia({ mic: true, cam: true });
          updateStatus("waiting");
          break;
        case "room-full":
          updateStatus("room-full");
          break;
        case "replaced":
          updateStatus("replaced");
          break;
        case "error":
          if (msg.code === "unauthorized") updateStatus("unauthorized");
          break;
      }
    },
    [closePeer, createPeer, flushCandidates, makeOffer, role, send, updateStatus]
  );

  const connectSocket = useCallback(() => {
    if (TERMINAL.includes(statusRef.current)) return;
    const ws = new WebSocket(getSignalingUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", roomId: token, role, ticket }));
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => send({ type: "ping" }), 20000);
    };
    ws.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      queueRef.current = queueRef.current.then(() => handleMessage(msg)).catch(() => {});
    };
    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (TERMINAL.includes(statusRef.current)) return;
      // Si la conexión P2P sigue viva, la llamada continúa; solo se reintenta la señalización
      if (statusRef.current !== "connected") updateStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
      retryRef.current += 1;
      retryTimerRef.current = setTimeout(connectSocket, delay);
    };
  }, [handleMessage, role, send, ticket, token, updateStatus]);

  const initMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await getLocalMedia();
    localStreamRef.current = stream;
    setLocalStream(stream);
    setCamEnabled(stream.getVideoTracks().length > 0);
    mediaStateRef.current = { mic: true, cam: stream.getVideoTracks().length > 0 };
    refreshPreview();
    const guardado = leerFondoGuardado();
    if (guardado !== "ninguno" && stream.getVideoTracks().length > 0) void aplicarFondoRef.current(guardado);
    return stream;
  }, [refreshPreview]);

  const join = useCallback(async () => {
    await initMedia();
    updateStatus("connecting");
    connectSocket();
  }, [connectSocket, initMedia, updateStatus]);

  const releaseMedia = useCallback(() => {
    procesadorRef.current?.stop();
    procesadorRef.current = null;
    setPreviewStream(null);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const leave = useCallback(() => {
    updateStatus("left");
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    send({ type: "leave" });
    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();
    closePeer();
  }, [closePeer, send, updateStatus]);

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const next = !tracks.some((t) => t.enabled);
    tracks.forEach((t) => (t.enabled = next));
    setMicEnabled(next);
    mediaStateRef.current = { ...mediaStateRef.current, mic: next };
    sendMediaState();
  }, [sendMediaState]);

  const toggleCam = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    if (tracks.length === 0) return;
    const next = !tracks.some((t) => t.enabled);
    tracks.forEach((t) => (t.enabled = next));
    if (procesadorRef.current) procesadorRef.current.track.enabled = next;
    setCamEnabled(next);
    mediaStateRef.current = { ...mediaStateRef.current, cam: next || Boolean(screenTrackRef.current) };
    sendMediaState();
  }, [sendMediaState]);

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    // El kind del receiver siempre está definido, aunque el sender tenga track null
    const transceiver = pcRef.current
      ?.getTransceivers()
      .find((t) => t.receiver.track?.kind === "video");
    if (transceiver) await transceiver.sender.replaceTrack(track);
  }, []);

  const stopScreenShare = useCallback(async () => {
    const screen = screenTrackRef.current;
    if (!screen) return;
    screenTrackRef.current = null;
    screen.stop();
    setSharingScreen(false);
    const camTrack = outgoingVideo();
    await replaceVideoTrack(camTrack);
    mediaStateRef.current = { ...mediaStateRef.current, cam: Boolean(camTrack?.enabled) };
    sendMediaState();
  }, [outgoingVideo, replaceVideoTrack, sendMediaState]);

  const startScreenShare = useCallback(async () => {
    if (screenTrackRef.current) return;
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = display.getVideoTracks()[0];
    if (!track) return;
    screenTrackRef.current = track;
    setSharingScreen(true);
    track.onended = () => void stopScreenShare();
    await replaceVideoTrack(track);
    mediaStateRef.current = { ...mediaStateRef.current, cam: true };
    sendMediaState();
  }, [replaceVideoTrack, sendMediaState, stopScreenShare]);

  const quitarProcesador = useCallback(async () => {
    const proc = procesadorRef.current;
    procesadorRef.current = null;
    if (!screenTrackRef.current) await replaceVideoTrack(localStreamRef.current?.getVideoTracks()[0] || null);
    proc?.stop();
    refreshPreview();
  }, [refreshPreview, replaceVideoTrack]);

  const aplicarFondo = useCallback(
    async (id: FondoId) => {
      fondoPedidoRef.current = id;
      setFondo(id);
      setFondoAviso(null);
      guardarFondo(id);
      const opcion = fondoPorId(id);
      const raw = localStreamRef.current?.getVideoTracks()[0];
      if (opcion.efecto.tipo === "ninguno" || !raw) {
        await quitarProcesador();
        return;
      }
      const fallar = async (aviso: string) => {
        if (fondoPedidoRef.current !== id) return;
        fondoPedidoRef.current = "ninguno";
        setFondo("ninguno");
        guardarFondo("ninguno");
        setFondoAviso(aviso);
        await quitarProcesador();
      };
      if (!fondosSoportados()) {
        await fallar("Este navegador no permite efectos de fondo. Seguimos sin efecto.");
        return;
      }
      setFondoCargando(true);
      try {
        if (procesadorRef.current) {
          await procesadorRef.current.setEfecto(opcion.efecto);
        } else {
          const proc = await crearProcesadorFondo(raw, opcion.efecto, () =>
            void fallar("Tu equipo va lento con el efecto de fondo, así que lo desactivamos para cuidar la llamada.")
          );
          // Si en el intertanto se eligió otra cosa o se soltó la cámara, descartar
          if (fondoPedidoRef.current !== id || localStreamRef.current?.getVideoTracks()[0] !== raw) {
            proc.stop();
            return;
          }
          proc.track.enabled = raw.enabled;
          procesadorRef.current = proc;
          if (!screenTrackRef.current) await replaceVideoTrack(proc.track);
          refreshPreview();
        }
      } catch {
        await fallar("No se pudo activar el efecto de fondo en este dispositivo. Seguimos sin efecto.");
      } finally {
        setFondoCargando(false);
      }
    },
    [quitarProcesador, refreshPreview, replaceVideoTrack]
  );
  aplicarFondoRef.current = aplicarFondo;

  useEffect(() => {
    return () => {
      procesadorRef.current?.stop();
      statusRef.current = "left";
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenTrackRef.current?.stop();
    };
  }, []);

  return {
    localStream,
    previewStream,
    remoteStream,
    fondo,
    fondoCargando,
    fondoAviso,
    aplicarFondo,
    cerrarAvisoFondo: () => setFondoAviso(null),
    status,
    peerPresent,
    micEnabled,
    camEnabled,
    sharingScreen,
    remoteMedia,
    initMedia,
    join,
    leave,
    releaseMedia,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
  };
}
