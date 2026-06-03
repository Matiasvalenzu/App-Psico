"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Loader2, Mic, MicOff, Save, Trash2, Music } from "lucide-react";

function getAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function getAudioExtension(mime: string) {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

interface VoiceProfile {
  id: number;
  fecha_creacion: string;
  updated_at: string;
  activo: boolean;
  embedding_model: string;
  embedding_dim: number | null;
  sample_count: number;
  sample_duration_seconds: number | null;
  compatible: boolean;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatS(value: number | null) {
  if (!value) return "-";
  return `${Math.round(value)}s`;
}

export default function VoiceEnrollmentPage() {
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<Blob[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoadingProfile(true);
    try {
      const res = await apiFetch("/voz/");
      const data = await res.json();
      const profiles: VoiceProfile[] = data.results || data;
      setProfile(profiles[0] || null);
    } catch {
      setMessageType("error");
      setMessage("No se pudo consultar el perfil de voz.");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function startRecording() {
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getAudioMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setSamples((prev) => [...prev, blob].slice(0, 5));
        setRecording(false);
      };
      rec.start(1000);
      setRecording(true);
    } catch {
      setMessageType("error");
      setMessage("No se pudo acceder al micrófono.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function enroll() {
    if (samples.length < 3) {
      setMessageType("error");
      setMessage("Graba al menos 3 muestras de voz.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const formData = new FormData();
      samples.forEach((s, i) => formData.append("samples", s, `muestra-${i + 1}.${getAudioExtension(s.type)}`));
      const res = await apiFetch("/voz/enroll/", { method: "POST", body: formData });
      if (!res.ok) {
        let detail = "No se pudo guardar el perfil.";
        try { const d = await res.json(); detail = d.error || d.detail || detail; } catch {}
        setMessageType("error");
        setMessage(detail);
        return;
      }
      setSamples([]);
      await loadProfile();
      setMessageType("success");
      setMessage("Perfil de voz ECAPA guardado correctamente.");
    } catch {
      setMessageType("error");
      setMessage("No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  function removeSample(index: number) {
    setSamples((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil de voz del psicólogo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Graba entre 3 y 5 muestras claras para identificar tu voz con ECAPA-TDNN
        </p>
      </div>

      {/* Profile status */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Estado del perfil</h2>
        {loadingProfile ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando perfil...</div>
        ) : profile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                profile.compatible ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
              }`}>
                <Mic className="h-7 w-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    profile.compatible ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}>
                    {profile.compatible ? "PERFIL ECAPA ACTIVO" : "PERFIL ANTIGUO NO COMPATIBLE"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{profile.embedding_model}</p>
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Dimensión embedding</span>
                <p className="font-medium">{profile.embedding_dim || "-"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Muestras usadas</span>
                <p className="font-medium">{profile.sample_count || 0}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Duración total</span>
                <p className="font-medium">{formatS(profile.sample_duration_seconds)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Última actualización</span>
                <p className="font-medium">{formatDate(profile.updated_at)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Mic className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No hay perfil activo</p>
            <p className="text-sm text-muted-foreground">Graba muestras para habilitar el reconocimiento del psicólogo</p>
          </div>
        )}
      </div>

      {/* Recording */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          Graba idealmente 5 muestras de unos 10 segundos, con tu voz natural, poco ruido ambiente y el mismo micrófono que usarás en sesiones reales.
        </div>

        <div className="flex items-center gap-3">
          {recording ? (
            <button onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground shadow-subtle transition-all hover:bg-destructive/90">
              <MicOff className="h-4 w-4" /> Detener muestra
            </button>
          ) : (
            <button onClick={startRecording} disabled={samples.length >= 5} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card disabled:opacity-50">
              <Mic className="h-4 w-4" /> Grabar muestra
            </button>
          )}
          {recording && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              Grabando...
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {samples.length}/5 muestras
          </span>
        </div>

        {samples.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Muestras grabadas</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {samples.map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 shadow-subtle">
                  <div className="flex items-center gap-2 text-sm">
                    <Music className="h-4 w-4 text-primary" />
                    <span>Muestra {i + 1}</span>
                  </div>
                  <button onClick={() => removeSample(i)} className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={enroll} disabled={samples.length < 3 || saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando perfil..." : "Guardar perfil de voz"}
        </button>

        {message && (
          <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
            messageType === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" :
            messageType === "error" ? "border border-destructive/20 bg-destructive/5 text-destructive" :
            "border border-info/30 bg-info/5 text-info dark:text-info"
          }`}>{message}</div>
        )}
      </div>
    </div>
  );
}
