"use client";

import { useCallback, useRef, useState } from "react";
import { getAudioMimeType } from "@/context/AudioRecordingContext";

export interface DualTrackResult {
  audioStereo: Blob;
  audioPsicologo?: Blob;
  audioPaciente?: Blob;
  mimeType: string;
}

const AUDIO_BITS_PER_SECOND = 64000;

/**
 * Graba una pista de audio estéreo unificada (Canal 0 = Psicólogo, Canal 1 = Paciente).
 * Pasan por un AudioContext con ChannelMergerNode(2):
 * - Canal 0 (L): Micrófono local del psicólogo.
 * - Canal 1 (R): Audio remoto del paciente (se conecta dinámicamente al llegar).
 * Si el paciente llega tarde o se desconecta temporalmente, su canal graba silencio nativo
 * dentro del mismo reloj de audio de 48kHz, garantizando alineación temporal al milisegundo.
 */
export function useDualTrackRecorder() {
  const [recording, setRecording] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const remoteSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const localSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("");
  const pendingRemoteRef = useRef<MediaStream | null>(null);

  const connectRemote = useCallback((stream: MediaStream) => {
    const ctx = ctxRef.current;
    const merger = mergerRef.current;
    if (!ctx || !merger || stream.getAudioTracks().length === 0) return;
    try {
      remoteSourceRef.current?.disconnect();
    } catch {}
    const source = ctx.createMediaStreamSource(stream);
    // Conectar el audio remoto del paciente al Canal 1 (Right)
    source.connect(merger, 0, 1);
    remoteSourceRef.current = source;
  }, []);

  const start = useCallback(
    (localStream: MediaStream) => {
      if (recorderRef.current) return;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      ctxRef.current = ctx;
      void ctx.resume().catch(() => {});

      const merger = ctx.createChannelMerger(2);
      mergerRef.current = merger;

      const dest = ctx.createMediaStreamDestination();
      dest.channelCount = 2;
      dest.channelCountMode = "explicit";
      destRef.current = dest;

      merger.connect(dest);

      // Conectar micrófono local del psicólogo al Canal 0 (Left)
      if (localStream.getAudioTracks().length > 0) {
        const localSource = ctx.createMediaStreamSource(
          new MediaStream(localStream.getAudioTracks())
        );
        localSource.connect(merger, 0, 0);
        localSourceRef.current = localSource;
      }

      if (pendingRemoteRef.current) connectRemote(pendingRemoteRef.current);

      const mimeType = getAudioMimeType();
      mimeRef.current = mimeType;
      const opts: MediaRecorderOptions = { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
      if (mimeType) opts.mimeType = mimeType;

      chunksRef.current = [];
      const recorder = new MediaRecorder(dest.stream, opts);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
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
    const recorder = recorderRef.current;
    if (!recorder) return null;

    await new Promise<void>((resolve) => {
      if (recorder.state === "inactive") return resolve();
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorderRef.current = null;
    setRecording(false);

    try {
      localSourceRef.current?.disconnect();
      remoteSourceRef.current?.disconnect();
    } catch {}
    await ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;

    const mimeType = mimeRef.current || "audio/webm";
    const audioStereo = new Blob(chunksRef.current, { type: mimeType });
    return {
      audioStereo,
      mimeType,
    };
  }, []);

  return { recording, start, attachRemote, stop };
}
