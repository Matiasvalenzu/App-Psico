"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn, formatDateCL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ESTADOS_PAGO, hoyISO, type Cobro } from "./cobros";
import { getApiErrorMessage } from "./utils";

// Marca el cobro pagado (con fecha) o pendiente (sin fecha). No toca la boleta.
export async function cambiarPago(cobroId: number, pagadoEl: string | null): Promise<Cobro> {
  const res = await apiFetch(`/facturacion/cobros/${cobroId}/${pagadoEl ? "marcar-pagado" : "marcar-pendiente"}/`, {
    method: "POST",
    body: JSON.stringify(pagadoEl ? { fecha: pagadoEl } : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(getApiErrorMessage(data, "No se pudo actualizar el pago."));
  return data;
}

function FechaPagoForm({
  cobroId,
  onCancel,
  onDone,
}: {
  cobroId: number;
  onCancel: () => void;
  onDone: (cobro: Cobro) => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const cobro = await cambiarPago(cobroId, fecha);
      toast.success("Cobro marcado como pagado.");
      onDone(cobro);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el pago.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`pago-fecha-${cobroId}`} className="text-sm font-medium">
          Fecha de pago
        </label>
        <Input
          id={`pago-fecha-${cobroId}`}
          type="date"
          max={hoyISO()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy || !fecha}>
          {busy && <Loader2 className="animate-spin" />}
          Marcar como pagado
        </Button>
      </div>
    </form>
  );
}

// Para marcar pagado desde fuera del borrador (menú de una sesión).
export function MarcarPagadoDialog({
  cobroId,
  onClose,
  onDone,
}: {
  cobroId: number | null;
  onClose: () => void;
  onDone: (cobro: Cobro) => void;
}) {
  return (
    <Dialog open={cobroId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar como pagado</DialogTitle>
          <DialogDescription>Indica el día en que recibiste el pago.</DialogDescription>
        </DialogHeader>
        {cobroId !== null && (
          <FechaPagoForm
            cobroId={cobroId}
            onCancel={onClose}
            onDone={(cobro) => {
              onDone(cobro);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Estado de pago dentro del borrador de la boleta, con quién lo cambió por última vez.
export function PagoCobro({
  cobro,
  soloLectura,
  onChanged,
}: {
  cobro: Cobro;
  soloLectura: boolean;
  onChanged: (cobro: Cobro) => void;
}) {
  const [marcando, setMarcando] = useState(false);
  const [busy, setBusy] = useState(false);
  const estado = ESTADOS_PAGO[cobro.estado_pago];
  const cambio = cobro.ultimo_cambio_pago;

  useEffect(() => setMarcando(false), [cobro.id]);

  async function volverAPendiente() {
    setBusy(true);
    try {
      onChanged(await cambiarPago(cobro.id, null));
      toast.success("El cobro volvió a pendiente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el pago.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            Pago
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", estado.className)}>{estado.label}</span>
            {cobro.estado_pago === "PAGADO" && cobro.pagado_el && (
              <span className="font-normal text-muted-foreground">el {formatDateCL(cobro.pagado_el)}</span>
            )}
          </p>
          {cambio && (
            <p className="text-xs text-muted-foreground">
              Cambiado por {cambio.usuario || "un usuario eliminado"} el {formatDateCL(cambio.fecha, true)}
            </p>
          )}
        </div>
        {!soloLectura && !marcando && (
          cobro.estado_pago === "PENDIENTE" ? (
            <Button size="sm" onClick={() => setMarcando(true)}>
              Marcar como pagado
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={volverAPendiente} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Volver a pendiente
            </Button>
          )
        )}
      </div>
      {marcando && (
        <FechaPagoForm
          cobroId={cobro.id}
          onCancel={() => setMarcando(false)}
          onDone={(actualizado) => {
            setMarcando(false);
            onChanged(actualizado);
          }}
        />
      )}
    </div>
  );
}
