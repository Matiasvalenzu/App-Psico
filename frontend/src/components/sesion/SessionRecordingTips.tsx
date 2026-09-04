"use client";

import React, { useState, useEffect } from "react";
import { Lightbulb, X, Laptop, VolumeX, Mic2, ChevronDown } from "lucide-react";

export default function SessionRecordingTips() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    const isDismissed = localStorage.getItem("hide_session_recording_tips") === "true";
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("hide_session_recording_tips", "true");
    setDismissed(true);
  };

  const handleReopen = () => {
    localStorage.removeItem("hide_session_recording_tips");
    setDismissed(false);
  };

  // Prevent flash while reading localStorage
  if (dismissed === null) {
    return null;
  }

  if (dismissed) {
    return (
      <div className="flex justify-end -mt-3 mb-2">
        <button
          type="button"
          onClick={handleReopen}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer shadow-2xs"
        >
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Consejos para tu grabación</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-4 sm:p-5 shadow-xs transition-all animate-in fade-in-50 duration-300">
      {/* Botón cerrar */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar consejos de grabación"
        className="absolute top-3.5 right-3.5 rounded-lg p-1 text-muted-foreground/80 hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        title="Cerrar cuadro de tips"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2.5 pr-8 mb-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Lightbulb className="h-4 w-4 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Guía para una grabación presencial óptima
          </h3>
          <p className="text-xs text-muted-foreground">
            Recomendaciones para obtener la máxima nitidez y precisión en tu informe clínico
          </p>
        </div>
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
        {/* Tip 1 */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 backdrop-blur-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Laptop className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Grabación en segundo plano</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Puedes volver a la ficha del paciente, revisar notas clínicas anteriores o minimizar el navegador para usar Word en tu computador. La sesión sigue grabando sin interrumpirse.
          </p>
        </div>

        {/* Tip 2 */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 backdrop-blur-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <VolumeX className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Espacio silencioso</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Mantente en una sala tranquila, sin música de fondo ni conversaciones de terceros en pasillos o salas contiguas para evitar que se cuelen en la transcripción.
          </p>
        </div>

        {/* Tip 3 */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 backdrop-blur-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Mic2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Posición del micrófono</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Ubica el micrófono a una distancia equilibrada entre tú y tu paciente. Una señal limpia permite a la IA separar e identificar con exactitud quién habla en cada momento.
          </p>
        </div>
      </div>
    </div>
  );
}
