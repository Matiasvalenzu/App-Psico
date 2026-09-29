"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  } else {
    servers.push({
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
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
      const videoTrack = screenTrackRef.current || stream.getVideoTracks()[0];
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
      if (role === "psicologo") {
        pc.createOffer({ iceRestart: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => send({ type: "offer", payload: pc.localDescription }))
          .catch(() => {});
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        updateStatus("connected");
      } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        handleReconnect();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === "connected") {
        updateStatus("connected");
        sendMediaState();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        handleReconnect();
      }
    };
    return pc;
  }, [closePeer, role, send, sendMediaState, updateStatus]);

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
          if (role === "psicologo") {
            await makeOffer();
          }
          break;
        case "ready":
          if (role === "psicologo") await makeOffer();
          break;
        case "offer": {
          if (role !== "paciente") return;
          const pc = createPeer();
          await pc.setRemoteDescription(msg.payload);
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
      void handleMessage(msg).catch(() => {});
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
    return stream;
  }, []);

  const join = useCallback(async () => {
    await initMedia();
    updateStatus("connecting");
    connectSocket();
  }, [connectSocket, initMedia, updateStatus]);

  const releaseMedia = useCallback(() => {
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
    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    await replaceVideoTrack(camTrack);
    mediaStateRef.current = { ...mediaStateRef.current, cam: Boolean(camTrack?.enabled) };
    sendMediaState();
  }, [replaceVideoTrack, sendMediaState]);

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

  useEffect(() => {
    return () => {
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
    remoteStream,
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
