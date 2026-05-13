"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Mic, Save, Square, Trash2 } from "lucide-react";

function getSupportedAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

export default function VoiceEnrollmentPage() {
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<Blob[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setSamples((prev) => [...prev, blob].slice(0, 5));
        setRecording(false);
      };

      recorder.start(1000);
      setRecording(true);
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function enroll() {
    if (samples.length < 3) {
      setMessageType("error");
      setMessage("Graba al menos 3 muestras de voz de unos 5 segundos.");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageType("info");
    try {
      const formData = new FormData();
      samples.forEach((sample, index) => {
        const extension = getAudioExtension(sample.type);
        formData.append("samples", sample, `muestra-${index + 1}.${extension}`);
      });
      const res = await apiFetch("/voz/enroll/", { method: "POST", body: formData });
      if (!res.ok) {
        let detail = "No se pudo guardar el perfil de voz.";
        try {
          const data = await res.json();
          detail = data.error || data.detail || detail;
        } catch {
          // Keep generic message when backend does not return JSON.
        }
        setMessageType("error");
        setMessage(detail);
        return;
      }
      setSamples([]);
      setMessageType("success");
      setMessage("Perfil de voz guardado correctamente.");
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("No se pudo guardar el perfil de voz.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil de voz del psicólogo</h1>
        <p className="text-sm text-muted-foreground">
          Graba entre 3 y 5 muestras cortas para identificar tu voz durante la diarización.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          {recording ? (
            <button
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
            >
              <Square className="h-4 w-4" />
              Detener muestra
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={samples.length >= 5}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Mic className="h-4 w-4" />
              Grabar muestra
            </button>
          )}
          <span className="text-sm text-muted-foreground">{samples.length}/5 muestras</span>
        </div>

        {samples.length > 0 && (
          <div className="space-y-2">
            {samples.map((sample, index) => (
              <div key={index} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>Muestra {index + 1}</span>
                <button
                  onClick={() => setSamples((prev) => prev.filter((_, i) => i !== index))}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={enroll}
          disabled={saving || samples.length < 3}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar perfil de voz"}
        </button>

        {message && (
          <p
            className={`text-sm font-medium ${
              messageType === "success"
                ? "text-green-700"
                : messageType === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
