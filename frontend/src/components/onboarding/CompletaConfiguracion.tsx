"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { apiFetch, getCurrentUser } from "@/lib/api";
import ImportarPacientes from "@/components/pacientes/ImportarPacientes";
import { EVENTO_ONBOARDING, PASOS_ONBOARDING, type PasoOnboarding } from "@/lib/onboarding";

// Tarjeta del panel con los pasos del onboarding que quedaron omitidos.
export default function CompletaConfiguracion({ onImportado }: { onImportado?: () => void }) {
  const [pendientes, setPendientes] = useState<PasoOnboarding[]>([]);
  const [oculta, setOculta] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (user.onboarding_completado !== true) return setPendientes([]);
      const pasos = (user.onboarding_pasos || {}) as Record<string, string>;
      let lista = PASOS_ONBOARDING.filter((p) => pasos[p.id] === "omitido").map((p) => p.id);
      if (!user.boletas_habilitadas || user.boletas_configuradas) lista = lista.filter((p) => p !== "boletas");
      if (lista.includes("voz")) {
        const r = await apiFetch("/voz/").catch(() => null);
        const d = r && r.ok ? await r.json() : null;
        const perfiles = d ? d.results || d : [];
        if (Array.isArray(perfiles) && perfiles.length) lista = lista.filter((p) => p !== "voz");
      }
      if (lista.includes("calendario")) {
        const r = await apiFetch("/agenda/google/status/").catch(() => null);
        const d = r && r.ok ? await r.json() : null;
        if (d?.connected) lista = lista.filter((p) => p !== "calendario");
      }
      setPendientes(lista);
    } catch {
      setPendientes([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
    window.addEventListener(EVENTO_ONBOARDING, cargar);
    return () => window.removeEventListener(EVENTO_ONBOARDING, cargar);
  }, [cargar]);

  async function listo(id: PasoOnboarding) {
    setPendientes((p) => p.filter((x) => x !== id));
    await apiFetch("/cuenta/perfil/", {
      method: "PATCH",
      body: JSON.stringify({ onboarding_pasos: { [id]: "hecho" } }),
    }).catch(() => null);
  }

  if (oculta || pendientes.length === 0) return null;

  return (
    <section className="relative rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <button
        type="button"
        onClick={() => setOculta(true)}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Ocultar por ahora"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Completa tu configuración</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Te quedan {pendientes.length === 1 ? "un paso" : `${pendientes.length} pasos`} para sacarle todo el provecho a Psiconex.</p>
      <ul className="divide-y divide-border/60">
        {pendientes.map((id) => {
          const paso = PASOS_ONBOARDING.find((p) => p.id === id)!;
          if (id === "pacientes") {
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-foreground">{paso.pendiente}</span>
                <span className="flex items-center gap-2">
                  <ImportarPacientes onDone={() => { void listo(id); onImportado?.(); }} />
                  <button type="button" onClick={() => listo(id)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">No lo necesito</button>
                </span>
              </li>
            );
          }
          return (
            <li key={id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <Link href={paso.href} onClick={() => id === "datos" || id === "consulta" ? listo(id) : undefined} className="group flex flex-1 items-center gap-1 text-foreground hover:text-primary">
                {paso.pendiente}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
