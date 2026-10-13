"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn, formatDateCL } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ESTADOS_BOLETA, formatCLP, hoyISO, MODOS_BOLETA, receptorIncompleto, type Cobro, type DelegacionBHE } from "./cobros";
import EmisionSii, { emitidaPorPsiconex } from "./EmisionSii";
import { getApiErrorMessage } from "./utils";
import { PagoCobro } from "./PagoCobro";

const URL_SII = "https://www.sii.cl/servicios_online/";

function CopyRow({ label, value }: { label: string; value: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-medium", !value && "text-muted-foreground")}>{value || "Sin dato"}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={copiar} disabled={!value} aria-label={`Copiar ${label}`}>
        <Copy />
      </Button>
    </div>
  );
}

// Borrador para emitir la boleta a mano en el portal del SII y registrar luego el folio.
export default function BorradorBoleta({
  cobro,
  delegacion,
  soloLectura,
  onClose,
  onChanged,
  onEdit,
  onDeleted,
}: {
  cobro: Cobro | null;
  delegacion: DelegacionBHE | null;
  soloLectura: boolean;
  onClose: () => void;
  onChanged: (cobro: Cobro) => void;
  onEdit: (cobro: Cobro) => void;
  onDeleted: (id: number) => void;
}) {
  const [folio, setFolio] = useState("");
  const [fechaEmision, setFechaEmision] = useState(hoyISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmarAnular, setConfirmarAnular] = useState(false);

  useEffect(() => {
    setFolio("");
    setFechaEmision(hoyISO());
    setError("");
    setConfirmarAnular(false);
  }, [cobro?.id]);

  if (!cobro) return null;
  const actual = cobro;

  const estado = ESTADOS_BOLETA[actual.estado_boleta];
  const incompleto = receptorIncompleto(actual);
  const plazoVencido = Boolean(actual.anulable_hasta && hoyISO() > actual.anulable_hasta);
  const tasa = Number(actual.tasa_retencion).toLocaleString("es-CL");
  const enEmision = actual.estado_boleta === "EN_EMISION";
  const porPsiconex = emitidaPorPsiconex(actual);
  const reemitible = Boolean(delegacion && !delegacion.motivo_bloqueo);

  async function accion(path: string, init: RequestInit, exito: string) {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`/facturacion/cobros/${actual.id}/${path}`, init);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "No se pudo completar la acción."));
        return null;
      }
      toast.success(exito);
      return data;
    } catch {
      setError("No se pudo completar la acción.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function marcarEmitida(e: React.FormEvent) {
    e.preventDefault();
    const data = await accion(
      "marcar-emitida/",
      { method: "POST", body: JSON.stringify({ folio: folio.trim(), fecha_emision: fechaEmision }) },
      "Boleta marcada como emitida."
    );
    if (data) onChanged(data);
  }

  async function marcarAnulada() {
    const data = await accion("marcar-anulada/", { method: "POST" }, "Boleta marcada como anulada.");
    if (data) onChanged(data);
  }

  async function eliminar() {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`/facturacion/cobros/${actual.id}/`, { method: "DELETE" });
      if (!res.ok) {
        setError(getApiErrorMessage(await res.json().catch(() => null), "No se pudo eliminar el cobro."));
        return;
      }
      toast.success("Cobro eliminado.");
      onDeleted(actual.id);
    } catch {
      setError("No se pudo eliminar el cobro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Boleta de honorarios
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", estado.className)}>{estado.label}</span>
          </DialogTitle>
          <DialogDescription>
            Cobro del {formatDateCL(actual.fecha_pago)} · {actual.paciente_nombre || "Paciente eliminado"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <PagoCobro cobro={actual} soloLectura={soloLectura} onChanged={onChanged} />

          {(delegacion || enEmision || porPsiconex) && (
            <EmisionSii
              cobro={actual}
              delegacion={delegacion}
              soloLectura={soloLectura}
              onChanged={onChanged}
              onEdit={() => onEdit(actual)}
            />
          )}

          {actual.estado_boleta === "PENDIENTE" && incompleto && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription>
                Falta el RUT o el nombre del receptor. Si el paciente es menor de edad, la boleta va a nombre del tutor:
                edita el cobro y completa su RUT antes de emitir.
              </AlertDescription>
            </Alert>
          )}

          {actual.estado_boleta === "PENDIENTE" && (
            <>
              {delegacion && <p className="text-sm font-medium">O emítela tú en el portal del SII:</p>}
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Entra a{" "}
                  <a href={URL_SII} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    sii.cl <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  con tu RUT y clave tributaria.
                </li>
                <li>Ve a Servicios online › Boletas de honorarios electrónicas › Emisor de boleta de honorarios › Emitir boleta.</li>
                <li>Copia los datos de abajo en el formulario y emite la boleta.</li>
                <li>Vuelve aquí y anota el folio que te entrega el SII.</li>
              </ol>
            </>
          )}

          <div className="divide-y divide-border/60 rounded-xl border border-border/70 px-4">
            <CopyRow label="RUT del receptor" value={actual.receptor_documento} />
            <CopyRow label="Nombre" value={actual.receptor_nombre} />
            <CopyRow label="Dirección" value={actual.receptor_direccion} />
            <CopyRow label="Comuna" value={actual.receptor_comuna} />
            <CopyRow label="Glosa" value={actual.glosa} />
            <CopyRow label="Monto bruto" value={String(actual.monto_bruto)} />
            <CopyRow label="Fecha" value={formatDateCL(actual.fecha_pago)} />
          </div>

          <div className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex justify-between">
              <span>Monto bruto</span>
              <span className="font-medium tabular-nums">{formatCLP(actual.monto_bruto)}</span>
            </div>
            <div className="flex justify-between">
              <span>Retención ({tasa} %)</span>
              <span className="font-medium tabular-nums">−{formatCLP(actual.monto_retencion)}</span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
              <span>Líquido</span>
              <span className="tabular-nums">{formatCLP(actual.monto_liquido)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              {actual.bhe_modo === "RETENCION_POR_EMISOR"
                ? "Retención a cargo tuyo: en el SII indica que la retención la hace el emisor y la pagas en tu F29."
                : MODOS_BOLETA[actual.bhe_modo]}
            </p>
          </div>

          {actual.estado_boleta === "EMITIDA" && !porPsiconex && (
            <div className="space-y-1 text-sm">
              <p>
                Folio <span className="font-semibold">{actual.boleta_folio}</span> · emitida el{" "}
                {formatDateCL(actual.boleta_fecha_emision)}
              </p>
              {actual.anulable_hasta && (
                <p className="text-muted-foreground">Se puede anular en el SII hasta el {formatDateCL(actual.anulable_hasta)}.</p>
              )}
            </div>
          )}

          {actual.estado_boleta === "ANULADA" && (
            <p className="text-sm text-muted-foreground">
              Folio {actual.boleta_folio} anulado.{" "}
              {reemitible ? "Puedes emitir una boleta nueva para este cobro." : "Si corresponde, registra un cobro nuevo y emite otra boleta."}
            </p>
          )}

          {!enEmision && !porPsiconex && (
            <p className="text-xs text-muted-foreground">
              {delegacion
                ? "Revisa con tu contador la retención y los datos del receptor."
                : "Psiconex prepara el borrador, pero la boleta la emites tú en el SII. Revisa con tu contador la retención y los datos del receptor."}
            </p>
          )}

          {!soloLectura && actual.estado_boleta === "PENDIENTE" && (
            <form onSubmit={marcarEmitida} className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <label htmlFor="boleta-folio" className="text-sm font-medium">
                  Folio del SII
                </label>
                <Input
                  id="boleta-folio"
                  inputMode="numeric"
                  value={folio}
                  onChange={(e) => setFolio(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="boleta-fecha" className="text-sm font-medium">
                  Fecha de emisión
                </label>
                <Input id="boleta-fecha" type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy || !folio || incompleto}>
                {busy && <Loader2 className="animate-spin" />}
                Marcar emitida
              </Button>
            </form>
          )}

          {!soloLectura && actual.estado_boleta === "EMITIDA" && confirmarAnular && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription className="space-y-3">
                <p>
                  {plazoVencido
                    ? `El plazo para anular en el SII venció el ${formatDateCL(actual.anulable_hasta)}. Revisa con tu contador antes de seguir.`
                    : "Primero anula la boleta en el portal del SII; aquí solo queda registrado."}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmarAnular(false)} disabled={busy}>
                    Volver
                  </Button>
                  <Button size="sm" variant="destructive" onClick={marcarAnulada} disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    Marcar anulada
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {!soloLectura && !enEmision && !porPsiconex && (
          <DialogFooter className="sm:justify-between">
            {actual.estado_boleta === "EMITIDA" ? (
              <Button variant="outline" onClick={() => setConfirmarAnular(true)} disabled={busy || confirmarAnular}>
                Marcar anulada
              </Button>
            ) : (
                <>
                <Button variant="ghost" className="text-destructive" onClick={eliminar} disabled={busy}>
                  <Trash2 />
                  Eliminar
                </Button>
                <Button variant="outline" onClick={() => onEdit(actual)} disabled={busy}>
                  <Pencil />
                  Editar
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
