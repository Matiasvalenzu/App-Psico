"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { FONDOS, type FondoId } from "@/lib/fondo-videollamada";
import { cn } from "@/lib/utils";

interface Props {
  fondo: FondoId;
  cargando: boolean;
  aviso: string | null;
  disabled?: boolean;
  onElegir: (id: FondoId) => void;
  onCerrarAviso: () => void;
}

const PANEL_W = 300;

export function FondoPicker({ fondo, cargando, aviso, disabled, onElegir, onCerrarAviso }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activo = fondo !== "ninguno";

  useLayoutEffect(() => {
    if (!open && !aviso) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - PANEL_W / 2), window.innerWidth - PANEL_W - 8);
      setPos({ left, bottom: window.innerHeight - r.top + 10 });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, aviso]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Efectos de fondo"
        aria-label="Efectos de fondo"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors disabled:opacity-50",
          activo ? "bg-sky-600 hover:bg-sky-700" : "bg-white/15 hover:bg-white/25"
        )}
      >
        {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
      </button>
      {pos &&
        (open || aviso) &&
        createPortal(
          <div
            ref={panelRef}
            style={{ left: pos.left, bottom: pos.bottom, width: PANEL_W }}
            className="fixed z-50 rounded-2xl border border-white/10 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur"
          >
            {aviso && (
              <div className={cn("flex items-start gap-2 rounded-xl bg-amber-500/15 p-2 text-xs text-amber-100", open && "mb-3")}>
                <span className="flex-1">{aviso}</span>
                <button type="button" onClick={onCerrarAviso} aria-label="Cerrar aviso" className="text-amber-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {open && (
              <>
                <p className="mb-2 text-xs font-semibold text-slate-300">Fondo</p>
                <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="Efectos de fondo">
                  {FONDOS.map((o) => {
                    const sel = o.id === fondo;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={sel}
                        title={o.nombre}
                        onClick={() => onElegir(o.id)}
                        className={cn(
                          "group relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-lg border-2 bg-slate-800 text-[10px] leading-tight",
                          sel ? "border-sky-400" : "border-transparent hover:border-white/30"
                        )}
                      >
                        {o.miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.miniatura} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : o.efecto.tipo === "difuminar" ? (
                          <div
                            className={cn(
                              "absolute inset-0 bg-gradient-to-br from-slate-500 via-slate-400 to-slate-600",
                              o.efecto.intensidad === "fuerte" ? "blur-md" : "blur-[2px]"
                            )}
                          />
                        ) : null}
                        <span className="relative z-10 rounded bg-black/55 px-1 py-0.5 text-center">{o.nombre}</span>
                        {sel && <Check className="absolute right-1 top-1 z-10 h-3.5 w-3.5 text-sky-300" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">El efecto se procesa en tu propio equipo.</p>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
