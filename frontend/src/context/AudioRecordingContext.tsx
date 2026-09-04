"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { apiFetch } from "@/lib/api";

interface StartRecordingParams {
  sesionId: string | number;
  pacienteId: string | number;
  pacienteNombre?: string;
  numeroSesion?: number | null;
}

interface AudioRecordingContextType {
  isRecording: boolean;
  elapsed: number;
  recordingSessionId: string | number | null;
  recordingPacienteId: string | number | null;
  recordingPacienteNombre: string | null;
  recordingNumeroSesion: number | null;
  isUploading: boolean;
  uploadError: string | null;
  lastUploadedSessionId: string | number | null;
  startRecording: (params: StartRecordingParams) => Promise<boolean>;
  stopRecording: () => Promise<boolean>;
  clearUploadError: () => void;
}

const AudioRecordingContext = createContext<AudioRecordingContextType | null>(null);

function getAudioMimeType() {
  if (typeof window === "undefined" || !window.MediaRecorder) return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function getAudioExtension(mime: string) {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

export function AudioRecordingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordingSessionId, setRecordingSessionId] = useState<
    string | number | null
  >(null);
  const [recordingPacienteId, setRecordingPacienteId] = useState<
    string | number | null
  >(null);
  const [recordingPacienteNombre, setRecordingPacienteNombre] = useState<
    string | null
  >(null);
  const [recordingNumeroSesion, setRecordingNumeroSesion] = useState<
    number | null
  >(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadedSessionId, setLastUploadedSessionId] = useState<
    string | number | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | number | null>(null);

  // Keep ref updated
  useEffect(() => {
    sessionIdRef.current = recordingSessionId;
  }, [recordingSessionId]);

  // Clean up streams if page unloads completely
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        e.preventDefault();
        e.returnValue = "Hay una grabación en curso. Si sales de la página, la grabación se detendrá.";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const uploadAudioBlob = useCallback(
    async (targetSessionId: string | number, durationSec: number, mimeType: string, chunks: Blob[]) => {
      if (chunks.length === 0) {
        setIsUploading(false);
        return false;
      }
      setIsUploading(true);
      setUploadError(null);
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const extension = getAudioExtension(mimeType);
        const formData = new FormData();
        formData.append("audio", blob, `sesion-${targetSessionId}.${extension}`);
        formData.append("duracion_segundos", String(durationSec));

        const res = await apiFetch(`/sesiones/${targetSessionId}/upload_audio/`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          setUploadError("No se pudo guardar el audio de la sesión.");
          return false;
        }

        setLastUploadedSessionId(targetSessionId);
        return true;
      } catch (err) {
        console.error("Error subiendo audio:", err);
        setUploadError("No se pudo subir el audio de la sesión.");
        return false;
      } finally {
        setIsUploading(false);
        chunksRef.current = [];
      }
    },
    []
  );

  const startRecording = useCallback(
    async ({
      sesionId,
      pacienteId,
      pacienteNombre = "Paciente",
      numeroSesion = null,
    }: StartRecordingParams) => {
      try {
        setUploadError(null);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getAudioMimeType();
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        streamRef.current = stream;
        mediaRecorderRef.current = rec;
        chunksRef.current = [];
        elapsedRef.current = 0;
        sessionIdRef.current = sesionId;

        setRecordingSessionId(sesionId);
        setRecordingPacienteId(pacienteId);
        setRecordingPacienteNombre(pacienteNombre);
        setRecordingNumeroSesion(numeroSesion);

        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        rec.onstop = async () => {
          const finalDuration = elapsedRef.current;
          const currentMime = rec.mimeType || "audio/webm";
          const currentChunks = [...chunksRef.current];
          const targetId = sessionIdRef.current;

          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;

          if (targetId) {
            await uploadAudioBlob(targetId, finalDuration, currentMime, currentChunks);
          }

          setRecordingSessionId(null);
          setRecordingPacienteId(null);
          setRecordingPacienteNombre(null);
          setRecordingNumeroSesion(null);
        };

        rec.start(1000);
        setIsRecording(true);
        setElapsed(0);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setElapsed((prev) => {
            const next = prev + 1;
            elapsedRef.current = next;
            return next;
          });
        }, 1000);

        return true;
      } catch (err) {
        console.error("Error al iniciar grabación:", err);
        setUploadError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
        return false;
      }
    },
    [uploadAudioBlob]
  );

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    return true;
  }, []);

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  return (
    <AudioRecordingContext.Provider
      value={{
        isRecording,
        elapsed,
        recordingSessionId,
        recordingPacienteId,
        recordingPacienteNombre,
        recordingNumeroSesion,
        isUploading,
        uploadError,
        lastUploadedSessionId,
        startRecording,
        stopRecording,
        clearUploadError,
      }}
    >
      {children}
    </AudioRecordingContext.Provider>
  );
}

export function useAudioRecording() {
  const context = useContext(AudioRecordingContext);
  if (!context) {
    throw new Error("useAudioRecording debe utilizarse dentro de un AudioRecordingProvider");
  }
  return context;
}
