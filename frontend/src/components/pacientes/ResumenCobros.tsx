"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getCurrentUser } from "@/lib/api";
import CobrosBloqueados from "@/components/suscripcion/CobrosBloqueados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { etiquetaCobros, formatCLP, hoyISO } from "@/app/dashboard/pacientes/[id]/_components/cobros";

interface Resumen {
  mes: string;
  pagado_mes: { total: number; cantidad: number };
  pendiente_mes: { total: number; cantidad: number };
  pendiente_total: { total: number; cantidad: number };
  retencion_mes: number;
  top_deudores: { paciente: number; nombre: string; total: number; cantidad: number }[];
  sesiones_sin_cobro: number;
  cobros_sin_sesion?: number;
  cobros_sin_sesion_paciente?: number | null;
}

// Resumen de cobros del inicio: solo para quien usa cobros (Plan Plus o cobros antiguos).
export default function ResumenCobros() {
  const [visible, setVisible] = useState<"plus" | "bloqueo" | "oculto">("oculto");
  const [enPrueba, setEnPrueba] = useState(false);
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setEnPrueba(user.suscripcion_estado === "trial");
        setVisible(user.boletas_habilitadas ? "plus" : "bloqueo");
      })
      .catch(() => setVisible("oculto"));
  }, []);

  useEffect(() => {
    if (visible !== "plus" || !mes) return;
    let vigente = true;
    apiFetch(`/facturacion/cobros/resumen/?mes=${mes}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => vigente && setResumen(data))
      .catch(() => vigente && setResumen(null));
    return () => {
      vigente = false;
    };
  }, [visible, mes]);

  async function descargarCsv() {
    setDescargando(true);
    try {
      const res = await apiFetch(`/facturacion/cobros/exportar/?mes=${mes}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `cobros-${mes}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar el CSV.");
    } finally {
      setDescargando(false);
    }
  }

  if (visible === "oculto") return null;
  if (visible === "bloqueo") return <CobrosBloqueados origen="dashboard" enPrueba={enPrueba} />;
  if (!resumen) return null;

  return (
    <section aria-label="Resumen de cobros" className="space-y-4 rounded-xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Cobros</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            aria-label="Mes del resumen"
            value={mes}
            max={hoyISO().slice(0, 7)}
            onChange={(e) => setMes(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={descargarCsv} disabled={descargando}>
            {descargando ? <Loader2 className="animate-spin" /> : <Download />}
            CSV para el contador
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          <p className="text-xs text-muted-foreground">Pendiente del mes</p>
          <p className="text-xl font-semibold tabular-nums">{formatCLP(resumen.pendiente_mes.total)}</p>
          <p className="text-xs text-muted-foreground">{etiquetaCobros(resumen.pendiente_mes.cantidad)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
          <p className="text-xs text-muted-foreground">Pagado en el mes</p>
          <p className="text-xl font-semibold tabular-nums">{formatCLP(resumen.pagado_mes.total)}</p>
          <p className="text-xs text-muted-foreground">{etiquetaCobros(resumen.pagado_mes.cantidad)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-4 py-3 lg:col-span-2">
          <p className="mb-1 text-xs text-muted-foreground">
            Te deben más · {formatCLP(resumen.pendiente_total.total)} pendiente en total
          </p>
          {resumen.top_deudores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie te debe.</p>
          ) : (
            <ol className="space-y-0.5 text-sm">
              {resumen.top_deudores.map((d) => (
                <li key={d.paciente} className="flex items-center justify-between gap-3">
                  <Link href={`/dashboard/pacientes/${d.paciente}?tab=cobros`} className="truncate hover:underline">
                    {d.nombre || "Paciente"}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCLP(d.total)} · {etiquetaCobros(d.cantidad)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {(resumen.cobros_sin_sesion ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground">
          <Link
            href={
              resumen.cobros_sin_sesion_paciente
                ? `/dashboard/pacientes/${resumen.cobros_sin_sesion_paciente}?tab=cobros&sin_sesion=1`
                : "/dashboard"
            }
            className="font-medium text-foreground underline underline-offset-2"
          >
            {resumen.cobros_sin_sesion === 1
              ? "1 cobro sin sesión asociada"
              : `${resumen.cobros_sin_sesion} cobros sin sesión asociada`}
          </Link>
        </p>
      )}

      {resumen.sesiones_sin_cobro > 0 && (
        <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {resumen.sesiones_sin_cobro === 1
            ? "1 sesión completada en el mes no tiene cobro registrado."
            : `${resumen.sesiones_sin_cobro} sesiones completadas en el mes no tienen cobro registrado.`}
        </p>
      )}
    </section>
  );
}
