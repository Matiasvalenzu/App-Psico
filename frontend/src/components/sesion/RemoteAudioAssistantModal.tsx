"use client";

import React, { useState } from "react";
import {
  Video,
  Mic,
  Volume2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
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
  const { startRemoteRecording, isRecording, isRemote, tabAudioActive, micAudioActive } =
    useAudioRecording();

  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [meetOpened, setMeetOpened] = useState(false);

  if (!open) return null;

  async function handleStartCapture() {
    setConnecting(true);
    setErrorMessage(null);
    setErrorType(null);

    const result = await startRemoteRecording({
      sesionId,
      pacienteId,
      pacienteNombre,
    });

    setConnecting(false);

    if (result.success) {
      setReady(true);
      if (onRecordingStarted) onRecordingStarted();
      // NOTA: NO llamamos a window.open() aquí.
      // La pestaña de Google Meet ya fue abierta en el Paso 1 y seleccionada
      // por el psicólogo en el diálogo del navegador. Abrir otra pestaña
      // generaba un duplicado confuso con doble Meet.
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
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-5">
          {!ready && !isRecording ? (
            <>
              {/* Guía en 3 pasos */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cómo capturar la sesión sin extensiones
                </h4>

                <div className="grid gap-3">
                  <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      1
                    </span>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        Abre Google Meet en tu navegador
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Inicia o únete a la videollamada con tu paciente en una pestaña de Chrome o Edge.
                      </p>
                      {meetUrl && (
                        <div className="mt-2.5">
                          <a
                            href={meetUrl}
                            target="PsiconexMeetSession"
                            rel="noopener noreferrer"
                            onClick={() => setMeetOpened(true)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                              meetOpened
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-300"
                                : "bg-sky-600 text-white hover:bg-sky-700"
                            }`}
                          >
                            {meetOpened ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                Pestaña de Meet abierta (clic para ver)
                              </>
                            ) : (
                              <>
                                <ExternalLink className="h-3.5 w-3.5" />
                                Abrir enlace de Meet
                              </>
                            )}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-50/50 p-3.5 dark:bg-sky-950/20">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                      2
                    </span>
                    <div className="text-sm">
                      <p className="font-semibold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                        <Volume2 className="h-4 w-4 text-sky-600" />
                        Selecciona la pestaña de Meet y marca "Compartir audio"
                      </p>
                      <p className="text-xs text-sky-900/80 dark:text-sky-300/80 mt-1 leading-relaxed">
                        Al presionar el botón abajo, tu navegador te preguntará qué compartir. Elige la pestaña <strong>Google Meet</strong> y asegúrate de marcar la casilla <strong>"Compartir audio de la pestaña"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      3
                    </span>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        Grabación dual y transcripción automática
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Psiconex capturará la voz del paciente desde la llamada y tu voz desde el micrófono, procesando todo con IA al terminar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error banner si olvidó compartir audio */}
              {errorType === "NO_TAB_AUDIO" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="text-sm text-amber-900 dark:text-amber-200">
                      <strong className="block font-semibold">
                        No se detectó el audio de la llamada
                      </strong>
                      <p className="mt-1 text-xs leading-relaxed">
                        Olvidaste marcar la casilla <strong>"Compartir audio de la pestaña"</strong> en la ventana emergente de Chrome. Vuelve a intentarlo asegurándote de activarla para poder transcribir al paciente.
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
            </>
          ) : (
            /* Estado Grabando / Listo */
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 animate-pulse">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-foreground">
                  ¡Sesión remota conectada y grabando!
                </h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  El audio de Google Meet y tu micrófono se están capturando simultáneamente. Puedes realizar tu sesión normalmente en la pestaña de Meet.
                </p>
              </div>

              {/* Indicadores de señal dual */}
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Audio Meet (Paciente)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {tabAudioActive ? "Señal activa" : "En espera de audio"}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Micrófono (Tú)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {micAudioActive ? "Señal activa" : "En espera de voz"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground max-w-md mx-auto">
                <strong>¿Cómo finalizar?</strong> Cuando termine la reunión, vuelve a esta pestaña de Psiconex y presiona <strong>"Detener"</strong> en la barra roja de grabación superior para procesar las notas clínicas con IA.
              </div>
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
            {ready || isRecording ? "Cerrar ventana" : "Cancelar"}
          </button>

          {!ready && !isRecording && (
            <button
              type="button"
              onClick={handleStartCapture}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Esperando selección...
                </>
              ) : errorType === "NO_TAB_AUDIO" ? (
                <>
                  <Volume2 className="h-4 w-4" />
                  Reintentar marcando "Compartir audio"
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Seleccionar pestaña de Meet y grabar
                </>
              )}
            </button>
          )}

          {(ready || isRecording) && (
            <div className="flex items-center gap-3">
              {meetUrl && (
                <a
                  href={meetUrl}
                  target="PsiconexMeetSession"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  Ver videollamada <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Entendido, continuar en Meet
              </button>
            </div>
          )}
        </div>
      </div>
    </ClientPortal>
  );
}
