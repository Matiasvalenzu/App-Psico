"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";
import {
  Loader2,
  Mic,
  MicOff,
  Save,
  Trash2,
  Music,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  X,
  Info,
  PlayCircle,
} from "lucide-react";
import { ClientPortal } from "@/components/ui/ClientPortal";
import { useTutorial } from "@/context/TutorialContext";
import { SAMPLE_TEXTS, getAudioExtension, useVoiceEnrollment } from "@/hooks/use-voice-enrollment";

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
  return formatDateCL(value, true);
}

function formatS(value: number | null) {
  if (!value) return "-";
  return `${Math.round(value)}s`;
}

export default function VoiceEnrollmentPage() {
  const { openTutorial } = useTutorial();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const {
    recording,
    recordingSeconds,
    samples,
    setSamples,
    message,
    setMessage,
    messageType,
    setMessageType,
    saving,
    currentTextIndex,
    shuffleText,
    startRecording,
    stopRecording,
    enroll,
    removeSample,
  } = useVoiceEnrollment({ onEnrolled: loadProfile });

  useEffect(() => {
    loadProfile();
  }, []);


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

  async function handleDeleteProfile() {
    if (!profile) return;
    setDeletingProfile(true);
    setMessage("");
    try {
      const res = await apiFetch("/voz/reset/", { method: "DELETE" });
      if (!res.ok) {
        // Fallback por ID si /reset/ no estuviese disponible
        const fallbackRes = await apiFetch(`/voz/${profile.id}/`, { method: "DELETE" });
        if (!fallbackRes.ok) {
          let detail = "No se pudo eliminar el perfil de voz.";
          try {
            const d = await fallbackRes.json();
            detail = d.detail || d.error || detail;
          } catch {}
          setMessageType("error");
          setMessage(detail);
          return;
        }
      }
      setProfile(null);
      setSamples([]);
      setShowDeleteModal(false);
      setMessageType("success");
      setMessage("Perfil de voz eliminado exitosamente. Puedes grabar nuevas muestras a continuación.");
    } catch {
      setMessageType("error");
      setMessage("Error al intentar eliminar el perfil de voz.");
    } finally {
      setDeletingProfile(false);
    }
  }


  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Perfil de voz del psicólogo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra tu voz para que Deepgram separe automáticamente tus intervenciones de las del paciente en sesiones clínicas y videollamadas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openTutorial("voz")}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary transition-all hover:bg-primary/20 shadow-xs shrink-0 self-start sm:self-auto"
          title="Ver tutorial de perfil de voz"
        >
          <PlayCircle className="h-4 w-4" />
          <span>Tutorial de perfil de voz</span>
        </button>
      </div>

      {/* Estado del perfil actual */}
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Estado del perfil</h2>
          {profile && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 hover:border-destructive/60 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar perfil actual
            </button>
          )}
        </div>

        {loadingProfile ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Consultando estado del perfil...
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <div
                className={`flex h-13 w-13 items-center justify-center rounded-2xl ${
                  profile.compatible
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                }`}
              >
                <Mic className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
                      profile.compatible
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {profile.compatible ? "PERFIL DE VOZ ACTIVO" : "PERFIL ANTIGUO NO COMPATIBLE"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground font-mono">{profile.embedding_model}</p>
              </div>
            </div>

            <div className="grid gap-2.5 text-sm sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground block">Dimensión embedding</span>
                <p className="font-semibold mt-0.5">{profile.embedding_dim || "192"}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground block">Muestras usadas</span>
                <p className="font-semibold mt-0.5">{profile.sample_count || 0}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground block">Duración total</span>
                <p className="font-semibold mt-0.5">{formatS(profile.sample_duration_seconds)}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground block">Última actualización</span>
                <p className="font-semibold mt-0.5 text-xs">{formatDate(profile.updated_at)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center rounded-xl border border-dashed border-border/80 bg-muted/20">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MicOff className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">No tienes un perfil de voz registrado</p>
            <p className="text-xs text-muted-foreground max-w-md mt-1">
              Graba entre 3 y 5 muestras a continuación para que el sistema aprenda a reconocer tu voz y aislarla de la del paciente.
            </p>
          </div>
        )}
      </div>

      {/* Guía e Instrucciones Reforzadas */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 dark:bg-sky-950/20 space-y-3.5">
        <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-semibold text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>¿Por qué es crucial un buen perfil de voz?</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Deepgram usa este perfil para distinguir cuándo hablas tú y cuándo el paciente, y atribuir mejor cada intervención en la transcripción.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
          <div className="flex items-start gap-2.5 rounded-xl bg-background/80 p-3 border border-border/50 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
              1
            </div>
            <div>
              <strong className="block text-foreground font-medium">Usa tu micrófono habitual</strong>
              <span className="text-muted-foreground">Graba con el mismo micrófono o audífonos que empleas en consulta.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-background/80 p-3 border border-border/50 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
              2
            </div>
            <div>
              <strong className="block text-foreground font-medium">Ambiente silencioso</strong>
              <span className="text-muted-foreground">Evita ruidos de fondo, música, ventiladores o eco en la habitación.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-background/80 p-3 border border-border/50 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
              3
            </div>
            <div>
              <strong className="block text-foreground font-medium">Tono y ritmo natural</strong>
              <span className="text-muted-foreground">Lee el texto sugerido a velocidad conversacional normal, sin impostar.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-background/80 p-3 border border-border/50 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
              4
            </div>
            <div>
              <strong className="block text-foreground font-medium">~10 segundos por muestra</strong>
              <span className="text-muted-foreground">El texto sugerido abajo está calibrado para durar exactamente este tiempo.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zona de Grabación y Lectura Guiada */}
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Grabación de muestras guiadas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Muestra actual: <strong className="text-foreground">{samples.length + 1} de 5</strong> (mínimo 3 requeridas)
            </p>
          </div>
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
            {samples.length}/5 grabadas
          </div>
        </div>

        {/* Teleprompter / Cuadro de texto a leer */}
        <div className={`rounded-2xl border transition-all p-5 ${
          recording
            ? "border-sky-500 bg-sky-500/5 shadow-md dark:bg-sky-950/20"
            : "border-border/80 bg-muted/30"
        }`}>
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>Texto para leer en voz alta:</span>
            </div>
            <button
              type="button"
              onClick={shuffleText}
              disabled={recording}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
              title="Cargar otro texto aleatorio"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cambiar texto
            </button>
          </div>

          {/* Párrafo para lectura */}
          <div className="py-4">
            <p className="text-base md:text-lg font-medium leading-relaxed text-foreground select-none">
              &ldquo;{SAMPLE_TEXTS[currentTextIndex]}&rdquo;
            </p>
          </div>

          {/* Feedback de tiempo en vivo durante la grabación */}
          {recording && (
            <div className="pt-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                  Grabando muestra: {recordingSeconds}s
                </span>
                <span className="text-muted-foreground">
                  {recordingSeconds >= 10 ? "Meta de 10s alcanzada" : `${Math.max(0, 10 - recordingSeconds)}s para duración ideal`}
                </span>
              </div>

              {/* Barra de progreso de 10 segundos */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${
                    recordingSeconds >= 10 ? "bg-emerald-500" : "bg-sky-600"
                  }`}
                  style={{ width: `${Math.min((recordingSeconds / 10) * 100, 100)}%` }}
                />
              </div>

              {recordingSeconds >= 10 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1 animate-fadeIn">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>¡Duración óptima alcanzada! Puedes presionar &ldquo;Detener muestra&rdquo; cuando termines de leer.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles de grabación */}
        <div className="flex flex-wrap items-center gap-3">
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:bg-destructive/90 cursor-pointer animate-pulse"
            >
              <MicOff className="h-4 w-4" /> Detener muestra ({recordingSeconds}s)
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={samples.length >= 5}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Mic className="h-4 w-4" /> Grabar muestra {samples.length + 1}
            </button>
          )}

          <span className="text-xs text-muted-foreground">
            {samples.length >= 5
              ? "Has completado las 5 muestras máximas."
              : samples.length >= 3
              ? "Ya tienes el mínimo recomendado (3). Puedes guardar o agregar hasta 5."
              : `Faltan ${3 - samples.length} muestras para el mínimo.`}
          </span>
        </div>

        {/* Muestras grabadas en esta tanda */}
        {samples.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Muestras listas para procesar ({samples.length}/5)
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {samples.map((sample, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 shadow-subtle"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <Music className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium block">Muestra {i + 1}</span>
                      <span className="text-xs text-muted-foreground">
                        {(sample.size / 1024).toFixed(1)} KB • {getAudioExtension(sample.type).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSample(i)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                    title="Eliminar muestra"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón Guardar / Entrenar Perfil */}
        <div className="pt-2">
          <button
            type="button"
            onClick={enroll}
            disabled={samples.length < 3 || saving || recording}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando perfil de voz..." : "Guardar perfil de voz"}
          </button>
        </div>

        {/* Mensajes de feedback */}
        {message && (
          <div
            className={`rounded-xl p-4 text-sm font-medium border flex items-start gap-3 ${
              messageType === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : messageType === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : messageType === "error" ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
            )}
            <div className="leading-relaxed">{message}</div>
          </div>
        )}
      </div>

      {/* Modal de confirmación para eliminar perfil de voz */}
      {showDeleteModal && (
        <ClientPortal>
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingProfile}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                ¿Eliminar perfil de voz actual?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta acción eliminará el embedding biométrico de tu voz en el sistema. Hasta que no grabes un nuevo perfil, la IA no podrá distinguir automáticamente tu voz de la del paciente en las sesiones clínicas.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingProfile}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={deletingProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-all disabled:opacity-50 cursor-pointer"
              >
                {deletingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingProfile ? "Eliminando..." : "Sí, eliminar perfil"}
              </button>
            </div>
          </div>
        </ClientPortal>
      )}
    </div>
  );
}
