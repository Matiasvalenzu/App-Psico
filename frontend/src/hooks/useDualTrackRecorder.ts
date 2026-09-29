"use client";

import { useCallback, useRef, useState } from "react";
import { getAudioMimeType } from "@/context/AudioRecordingContext";

export interface DualTrackResult {
  audioPsicologo: Blob;
  audioPaciente: Blob;
  mimeType: string;
}

const AUDIO_BITS_PER_SECOND = 32000;

/**
 * Graba dos pistas de audio alineadas (psicólogo / paciente).
 * Ambas pasan por un AudioContext con destinos independientes: los dos
 * MediaRecorder arrancan en el mismo instante y, si el paciente se reconecta,
 * se conecta la nueva fuente sin cortar la grabación (los huecos quedan como silencio).
 * Nunca se conecta a audioContext.destination para no reproducir eco.
 */
export function useDualTrackRecorder() {
  const [recording, setRecording] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const destLocalRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const destRemoteRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const remoteSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const localSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordersRef = useRef<{ local: MediaRecorder; remote: MediaRecorder } | null>(null);
  const chunksRef = useRef<{ local: Blob[]; remote: Blob[] }>({ local: [], remote: [] });
  const mimeRef = useRef("");
  const pendingRemoteRef = useRef<MediaStream | null>(null);

  const connectRemote = useCallback((stream: MediaStream) => {
    const ctx = ctxRef.current;
    const dest = destRemoteRef.current;
    if (!ctx || !dest || stream.getAudioTracks().length === 0) return;
    try {
      remoteSourceRef.current?.disconnect();
    } catch {}
    const source = ctx.createMediaStreamSource(stream);
    source.connect(dest);
    remoteSourceRef.current = source;
  }, []);

  const start = useCallback(
    (localStream: MediaStream) => {
      if (recordersRef.current) return;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      ctxRef.current = ctx;
      void ctx.resume().catch(() => {});

      const destLocal = ctx.createMediaStreamDestination();
      const destRemote = ctx.createMediaStreamDestination();
      destLocalRef.current = destLocal;
      destRemoteRef.current = destRemote;

      if (localStream.getAudioTracks().length > 0) {
        const localSource = ctx.createMediaStreamSource(
          new MediaStream(localStream.getAudioTracks())
        );
        localSource.connect(destLocal);
        localSourceRef.current = localSource;
      }
      if (pendingRemoteRef.current) connectRemote(pendingRemoteRef.current);

      const mimeType = getAudioMimeType();
      mimeRef.current = mimeType;
      const opts: MediaRecorderOptions = { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
      if (mimeType) opts.mimeType = mimeType;

      chunksRef.current = { local: [], remote: [] };
      const local = new MediaRecorder(destLocal.stream, opts);
      const remote = new MediaRecorder(destRemote.stream, opts);
      local.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.local.push(e.data);
      remote.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.remote.push(e.data);
      local.start(1000);
      remote.start(1000);
      recordersRef.current = { local, remote };
      setRecording(true);
    },
    [connectRemote]
  );

  const attachRemote = useCallback(
    (stream: MediaStream | null) => {
      pendingRemoteRef.current = stream;
      if (stream) connectRemote(stream);
    },
    [connectRemote]
  );

  const stop = useCallback(async (): Promise<DualTrackResult | null> => {
    const recorders = recordersRef.current;
    if (!recorders) return null;
    const stopOne = (r: MediaRecorder) =>
      new Promise<void>((resolve) => {
        if (r.state === "inactive") return resolve();
        r.onstop = () => resolve();
        r.stop();
      });
    await Promise.all([stopOne(recorders.local), stopOne(recorders.remote)]);
    recordersRef.current = null;
    setRecording(false);

    try {
      localSourceRef.current?.disconnect();
      remoteSourceRef.current?.disconnect();
    } catch {}
    await ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;

    const mimeType = mimeRef.current || "audio/webm";
    return {
      audioPsicologo: new Blob(chunksRef.current.local, { type: mimeType }),
      audioPaciente: new Blob(chunksRef.current.remote, { type: mimeType }),
      mimeType,
    };
  }, []);

  return { recording, start, attachRemote, stop };
}
