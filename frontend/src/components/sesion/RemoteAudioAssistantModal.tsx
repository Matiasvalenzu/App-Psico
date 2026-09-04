"use client";

import React, { useState } from "react";
import {
  Video,
  Volume2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ClientPortal } from "@/components/ui/ClientPortal";
import { useAudioRecording } from "@/context/AudioRecordingContext";

interface RemoteAudioAssistantModalProps {
  open: boolean;
  onClose: () => void;
  sesionId: number;
  pacienteId: number;
  pacienteNombre: string;
  meetUrl?: string;
  onRecordingStarted?: () => void;
}

export function RemoteAudioAssistantModal({
  open,
  onClose,
  sesionId,
  pacienteId,
  pacienteNombre,
  meetUrl,
  onRecordingStarted,
}: RemoteAudioAssistantModalProps) {
  const { startRemoteRecording } = useAudioRecording();

  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  if (!open) return null;

  async function handleStartCapture() {
    setConnecting(true);
    setErrorMessage(null);
    setErrorType(null);

    // 1. Invocar el selector de captura mientras el usuario permanece en Psiconex
    const result = await startRemoteRecording({
      sesionId,
      pacienteId,
      pacienteNombre,
    });

    setConnecting(false);

    if (result.success) {
      // 2. Tras confirmar compartir pantalla/audio, abrir Meet inmediatamente
      if (meetUrl) {
        window.open(meetUrl, "PsiconexMeetSession", "noopener,noreferrer");
      }
      if (onRecordingStarted) onRecordingStarted();
      // Cerrar el modal para que el usuario quede enfocado en Google Meet
      onClose();
    } else {
      setErrorType(result.error || "UNKNOWN");
      setErrorMessage(
        result.message ||
          "No se pudo conectar el audio. Por favor intenta de nuevo."
      );
    }
  }

  return (
    <ClientPortal>
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                Grabación de Videollamada Google Meet
              </h3>
              <p className="text-xs text-muted-foreground">
                Paciente: <strong className="text-foreground">{pacienteNombre}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-4">
          {/* Tarjeta explicativa con instrucción clave */}
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4.5 dark:bg-sky-950/20">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-sm space-y-1">
                <h4 className="font-semibold text-foreground">
                  Confirmación en 1 solo clic
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Al presionar el botón abajo, tu navegador te pedirá confirmar la grabación en esta pantalla. Al presionar <strong>Compartir</strong>, se abrirá Google Meet automáticamente y quedarás en tu llamada con la sesión ya grabando.
                </p>
              </div>
            </div>

            {/* Regla clave: Compartir audio */}
            <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50/80 p-3 text-xs dark:bg-amber-950/30">
              <Volume2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-amber-950 dark:text-amber-200 leading-relaxed">
                <strong className="font-semibold block">Paso clave en Chrome o Edge:</strong>
                Elige <strong>Toda la pantalla</strong> y asegúrate de marcar la casilla <strong>&quot;Compartir también el audio del sistema&quot;</strong> para que Psiconex capture la voz del paciente.
              </div>
            </div>
          </div>

          {/* Banner de error si olvidó marcar compartir audio */}
          {errorType === "NO_TAB_AUDIO" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div className="text-sm text-destructive">
                  <strong className="block font-semibold">
                    No se detectó el audio de la llamada
                  </strong>
                  <p className="mt-1 text-xs leading-relaxed text-destructive/90">
                    Olvidaste activar la casilla <strong>&quot;Compartir audio del sistema&quot;</strong> en la ventana emergente de Chrome. Presiona reintentar y asegúrate de marcarla.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Otros errores */}
          {errorMessage && errorType !== "NO_TAB_AUDIO" && errorType !== "CANCELLED" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleStartCapture}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Esperando confirmación...
              </>
            ) : errorType === "NO_TAB_AUDIO" ? (
              <>
                <Volume2 className="h-4 w-4" />
                Reintentar marcando &quot;Compartir audio&quot;
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Iniciar grabación y abrir Meet
              </>
            )}
          </button>
        </div>
      </div>
    </ClientPortal>
  );
}
