"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { cn, formatDateCL } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import BorradorBoleta from "./BorradorBoleta";
import CobroDialog from "./CobroDialog";
import { ESTADOS_BOLETA, formatCLP, type Cobro, type DelegacionBHE } from "./cobros";
import { fetchAllPages } from "./utils";

// Cobros del paciente. `refreshKey` permite recargar cuando se crea un cobro desde una sesión.
export default function CobrosPaciente({
  pacienteId,
  soloLectura,
  refreshKey = 0,
}: {
  pacienteId: number;
  soloLectura: boolean;
  refreshKey?: number;
}) {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccionado, setSeleccionado] = useState<Cobro | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Cobro | null>(null);
  // Solo con la emisión automática disponible (flag BHE_AUTO_DISPONIBLE); si no, la ficha sigue con el flujo manual.
  const [delegacion, setDelegacion] = useState<DelegacionBHE | null>(null);

  const cargar = useCallback(async () => {
    setError("");
    try {
      setCobros(await fetchAllPages<Cobro>(`/facturacion/cobros/?paciente=${pacienteId}`));
    } catch {
      setError("No se pudieron cargar los cobros.");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  useEffect(() => {
    if (soloLectura) return;
    getCurrentUser()
      .then(async (user) => {
        if (!user.bhe_auto_disponible) return;
        const res = await apiFetch("/facturacion/delegacion/");
        if (res.ok) setDelegacion(await res.json());
      })
      .catch(() => setDelegacion(null));
  }, [soloLectura]);

  function reemplazar(cobro: Cobro) {
    setCobros((prev) => {
      const existe = prev.some((c) => c.id === cobro.id);
      const next = existe ? prev.map((c) => (c.id === cobro.id ? cobro : c)) : [cobro, ...prev];
      return next.sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.id - a.id);
    });
  }

  function abrirNuevo() {
    setEditando(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Cobros y boletas</h2>
          <p className="text-sm text-muted-foreground">Registra el pago y prepara la boleta para emitirla en el SII.</p>
        </div>
        {!soloLectura && (
          <Button onClick={abrirNuevo}>
            <Plus />
            Registrar cobro
          </Button>
        )}
      </div>

      {soloLectura && (
        <Alert variant="warning">
          <AlertDescription>
            Las boletas son parte del Plan Plus. Puedes ver tus cobros, pero para registrar nuevos{" "}
            <Link href="/dashboard/suscripcion" className="font-medium underline">
              revisa tu suscripción
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : cobros.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 py-10 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Todavía no hay cobros</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Registra un cobro aquí o desde el menú de una sesión. Psiconex calcula la retención y arma el borrador de la boleta.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 text-right font-medium">Monto</th>
                <th className="px-4 py-2 font-medium">Pago</th>
                <th className="px-4 py-2 font-medium">Boleta</th>
                <th className="px-4 py-2 font-medium">Folio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {cobros.map((cobro) => {
                const estado = ESTADOS_BOLETA[cobro.estado_boleta];
                return (
                  <tr
                    key={cobro.id}
                    onClick={() => setSeleccionado(cobro)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSeleccionado(cobro)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">{formatDateCL(cobro.fecha_pago)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCLP(cobro.monto_bruto)}</td>
                    <td className="px-4 py-3">{cobro.estado_pago === "PAGADO" ? "Pagado" : "Pendiente"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", estado.className)}>{estado.label}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{cobro.boleta_folio || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BorradorBoleta
        cobro={seleccionado}
        delegacion={delegacion}
        soloLectura={soloLectura}
        onClose={() => setSeleccionado(null)}
        onChanged={(cobro) => {
          reemplazar(cobro);
          setSeleccionado(cobro);
        }}
        onEdit={(cobro) => {
          setSeleccionado(null);
          setEditando(cobro);
          setDialogOpen(true);
        }}
        onDeleted={(id) => {
          setCobros((prev) => prev.filter((c) => c.id !== id));
          setSeleccionado(null);
        }}
      />

      {!soloLectura && (
        <CobroDialog
          open={dialogOpen}
          pacienteId={pacienteId}
          cobro={editando}
          onOpenChange={setDialogOpen}
          onSaved={(cobro) => {
            reemplazar(cobro);
            setSeleccionado(cobro);
          }}
        />
      )}
    </div>
  );
}
