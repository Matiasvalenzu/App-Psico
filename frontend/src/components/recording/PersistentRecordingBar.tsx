"use client";

import React from "react";
import Link from "next/link";
import { useAudioRecording } from "@/context/AudioRecordingContext";
import { formatSeconds } from "@/lib/utils";
import { Loader2, Square, ExternalLink, AlertCircle, X } from "lucide-react";

export default function PersistentRecordingBar() {
  const {
    isRecording,
    elapsed,
    recordingSessionId,
    recordingPacienteId,
    recordingPacienteNombre,
    recordingNumeroSesion,
    isUploading,
    uploadError,
    stopRecording,
    clearUploadError,
  } = useAudioRecording();

  if (!isRecording && !isUploading && !uploadError) {
    return null;
  }

  const sessionLink =
    recordingPacienteId && recordingSessionId
      ? `/dashboard/pacientes/${recordingPacienteId}/sesiones/${recordingSessionId}`
      : null;

  return (
    <aside
      aria-label="Estado de grabación de sesión activa"
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 rounded-2xl border border-red-500/30 bg-background/95 p-3.5 sm:px-5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
        {/* Info & Timer */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isRecording ? (
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600" />
            </span>
          ) : isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {isRecording ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Grabando en segundo plano
                </span>
                <span className="text-sm font-mono font-bold tabular-nums text-foreground animate-pulse">
                  {formatSeconds(elapsed)}
                </span>
              </div>
            ) : isUploading ? (
              <p className="text-xs font-semibold text-primary">
                Guardando y procesando audio...
              </p>
            ) : (
              <p className="text-xs font-medium text-destructive truncate">
                {uploadError}
              </p>
            )}

            {recordingPacienteNombre && (
              <p className="text-xs text-muted-foreground truncate">
                {recordingPacienteNombre}
                {recordingNumeroSesion ? ` · Sesión ${recordingNumeroSesion}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {sessionLink && (
            <Link
              href={sessionLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-xs"
            >
              <span>Ver sesión</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-all cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Detener</span>
            </button>
          )}

          {uploadError && (
            <button
              onClick={clearUploadError}
              aria-label="Cerrar aviso de error"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
