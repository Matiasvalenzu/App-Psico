"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ESTADOS_PAGO, formatCLP, type Cobro } from "./cobros";
import { fetchAllPages } from "./utils";

export type SesionVinculo = {
  id: number;
  numero_sesion: number | null;
  fecha_hora_inicio: string;
  origen?: string;
  cobro?: { id: number } | null;
};

export function ordenarSesiones(lista: SesionVinculo[], cobroId?: number) {
  const libre = (sesion: SesionVinculo) => !sesion.cobro || sesion.cobro.id === cobroId;
  return [...lista].sort((a, b) => {
    const grupo = Number(!libre(a)) - Number(!libre(b));
    if (grupo) return grupo;
    return b.fecha_hora_inicio.localeCompare(a.fecha_hora_inicio);
  });
}

export function primeraLibre(lista: SesionVinculo[], cobroId?: number) {
  return ordenarSesiones(lista, cobroId).find((sesion) => !sesion.cobro || sesion.cobro.id === cobroId);
}

function etiqueta(sesion: SesionVinculo) {
  return `${sesion.numero_sesion ? `Sesión ${sesion.numero_sesion}` : "Sesión"} · ${formatDateCL(sesion.fecha_hora_inicio)}`;
}

export function SelectorSesiones({
  opciones,
  elegidas,
  cobroId,
  onChange,
  mostrarSinSesion,
}: {
  opciones: SesionVinculo[];
  elegidas: number[];
  cobroId?: number;
  onChange: (ids: number[]) => void;
  mostrarSinSesion?: boolean;
}) {
  const ordenadas = ordenarSesiones(opciones, cobroId);
  const sinElegir = elegidas.length === 0;
  return (
    <div className="max-h-52 space-y-1.5 overflow-y-auto">
      {ordenadas.map((sesion) => {
        const ocupada = Boolean(sesion.cobro && sesion.cobro.id !== cobroId);
        return (
          <label key={sesion.id} className={`flex items-center gap-2 text-sm ${ocupada ? "text-muted-foreground" : ""}`}>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={elegidas.includes(sesion.id)}
              disabled={ocupada}
              onChange={(e) =>
                onChange(e.target.checked ? [...elegidas, sesion.id] : elegidas.filter((id) => id !== sesion.id))
              }
            />
            <span>
              {etiqueta(sesion)}
              {ocupada && <span className="ml-2 text-xs">Ya cobrada</span>}
            </span>
          </label>
        );
      })}
      {(mostrarSinSesion || ordenadas.length === 0 || sinElegir) && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-primary"
            checked={sinElegir}
            onChange={() => onChange([])}
          />
          <span>
            Sin sesión por ahora
            <span className="mt-0.5 block text-xs text-muted-foreground">Podrás asociarlo a una sesión después</span>
          </span>
        </label>
      )}
    </div>
  );
}

export function AsociarSesionDialog({
  open,
  cobro,
  pacienteId,
  sesiones,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  cobro: Cobro | null;
  pacienteId: number;
  sesiones?: SesionVinculo[];
  onOpenChange: (open: boolean) => void;
  onSaved: (cobro: Cobro) => void;
}) {
  const [opciones, setOpciones] = useState<SesionVinculo[]>([]);
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !cobro) return;
    const actuales = cobro.sesiones?.length ? cobro.sesiones : (cobro.sesiones_detalle ?? []).map((s) => s.id);
    setElegidas(actuales);
    setError("");
    const conocidas = (sesiones ?? []).filter((s) => s.origen !== "DOCUMENTO_EXTERNO");
    setOpciones(conocidas);
    let activo = true;
    fetchAllPages<SesionVinculo>(`/sesiones/?paciente=${pacienteId}`)
      .then((lista) => {
        if (!activo) return;
        const clinicas = lista.filter((s) => s.origen !== "DOCUMENTO_EXTERNO");
        if (clinicas.length) setOpciones(clinicas);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [open, cobro, pacienteId, sesiones]);

  async function guardar() {
    if (!cobro) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/facturacion/cobros/${cobro.id}/vincular-sesiones/`, {
        method: "POST",
        body: JSON.stringify({ sesiones: elegidas }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || "No se pudieron actualizar las sesiones.");
        return;
      }
      onSaved(data);
      onOpenChange(false);
    } catch {
      setError("No se pudieron actualizar las sesiones.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asociar sesión</DialogTitle>
          <DialogDescription>Puedes agregar o quitar sesiones. La boleta ya emitida no se modifica.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SelectorSesiones opciones={opciones} elegidas={elegidas} cobroId={cobro?.id} onChange={setElegidas} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VincularCobroDialog({
  open,
  pacienteId,
  sesionId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  pacienteId: number;
  sesionId: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (cobro: Cobro) => void;
}) {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [elegido, setElegido] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setElegido(null);
    setError("");
    let activo = true;
    fetchAllPages<Cobro>(`/facturacion/cobros/?paciente=${pacienteId}&sin_sesion=1`)
      .then((lista) => {
        if (activo) setCobros(lista);
      })
      .catch(() => {
        if (activo) setError("No se pudieron cargar los cobros.");
      });
    return () => {
      activo = false;
    };
  }, [open, pacienteId]);

  async function guardar() {
    if (!elegido || !sesionId) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/facturacion/cobros/${elegido}/vincular-sesiones/`, {
        method: "POST",
        body: JSON.stringify({ sesiones: [sesionId] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || "No se pudo vincular el cobro.");
        return;
      }
      onSaved(data);
      onOpenChange(false);
    } catch {
      setError("No se pudo vincular el cobro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular a un cobro existente</DialogTitle>
          <DialogDescription>Cobros de este paciente que todavía no tienen sesión.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {cobros.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">No hay cobros sin sesión.</p>
        ) : (
          <div className="max-h-52 space-y-1.5 overflow-y-auto">
            {cobros.map((cobro) => (
              <label key={cobro.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cobro-existente"
                  className="h-4 w-4 accent-primary"
                  checked={elegido === cobro.id}
                  onChange={() => setElegido(cobro.id)}
                />
                <span>
                  {formatDateCL(cobro.fecha_pago)} · {formatCLP(cobro.monto_bruto)} · {ESTADOS_PAGO[cobro.estado_pago].label}
                </span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={saving || !elegido}>
            {saving && <Loader2 className="animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
