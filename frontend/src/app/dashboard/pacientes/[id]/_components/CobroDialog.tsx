"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatRut } from "@/lib/rut";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hoyISO, MEDIOS_PAGO, MODOS_BOLETA, type Cobro } from "./cobros";
import { fetchAllPages } from "./utils";
import { primeraLibre, SelectorSesiones, type SesionVinculo } from "./VinculoSesionDialogs";

type FormState = {
  fecha_pago: string;
  monto_bruto: string;
  medio_pago: string;
  estado_pago: string;
  bhe_modo: string;
  glosa: string;
  notas: string;
  receptor_tipo_doc: string;
  receptor_documento: string;
  receptor_nombre: string;
  receptor_direccion: string;
  receptor_comuna: string;
  receptor_email: string;
};

const CAMPOS_RECEPTOR = [
  "receptor_tipo_doc",
  "receptor_documento",
  "receptor_nombre",
  "receptor_direccion",
  "receptor_comuna",
  "receptor_email",
] as const;

function toForm(cobro: Cobro | null, fecha: string): FormState {
  return {
    fecha_pago: cobro?.fecha_pago ?? fecha,
    monto_bruto: cobro ? String(cobro.monto_bruto) : "",
    medio_pago: cobro?.medio_pago ?? "TRANSFERENCIA",
    estado_pago: cobro?.estado_pago ?? "PAGADO",
    bhe_modo: cobro?.bhe_modo ?? "RETENCION_POR_EMISOR",
    glosa: cobro?.glosa ?? "",
    notas: cobro?.notas ?? "",
    receptor_tipo_doc: cobro?.receptor_tipo_doc ?? "RUT",
    receptor_documento: cobro?.receptor_documento ?? "",
    receptor_nombre: cobro?.receptor_nombre ?? "",
    receptor_direccion: cobro?.receptor_direccion ?? "",
    receptor_comuna: cobro?.receptor_comuna ?? "",
    receptor_email: cobro?.receptor_email ?? "",
  };
}

// Crear o editar un cobro. Al crear, el receptor se copia desde la ficha y la glosa desde el perfil.
export default function CobroDialog({
  open,
  pacienteId,
  sesionId,
  sesiones,
  fechaInicial,
  cobro,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  pacienteId: number;
  sesionId?: number | null;
  sesiones?: SesionVinculo[];
  fechaInicial?: string;
  cobro?: Cobro | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (cobro: Cobro) => void;
}) {
  const editando = Boolean(cobro);
  const [form, setForm] = useState<FormState>(() => toForm(cobro ?? null, fechaInicial || hoyISO()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [opciones, setOpciones] = useState<SesionVinculo[]>([]);
  const [cargandoSesiones, setCargandoSesiones] = useState(false);
  const [errorSesiones, setErrorSesiones] = useState("");
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [incluirGlosa, setIncluirGlosa] = useState(false);
  const glosaBloqueada = cobro?.estado_boleta === "EMITIDA" || cobro?.estado_boleta === "EN_EMISION";

  useEffect(() => {
    if (!open || !Number.isFinite(pacienteId)) return;
    let activo = true;
    const conocidas = (sesiones ?? []).filter((s) => s.origen !== "DOCUMENTO_EXTERNO");
    const actuales = cobro?.sesiones?.length ? cobro.sesiones : (cobro?.sesiones_detalle ?? []).map((s) => s.id);
    const libre = !cobro && !sesionId ? primeraLibre(conocidas)?.id : undefined;
    setForm(toForm(cobro ?? null, fechaInicial || hoyISO()));
    setElegidas(actuales.length ? actuales : sesionId ? [sesionId] : libre ? [libre] : []);
    setIncluirGlosa(Boolean(cobro?.glosa_incluye_sesion));
    setError("");
    setFieldErrors({});
    setErrorSesiones("");
    setOpciones(conocidas);
    setCargandoSesiones(true);
    fetchAllPages<SesionVinculo>(`/sesiones/?paciente=${pacienteId}`)
      .then((lista) => {
        if (!activo) return;
        const clinicas = lista.filter((s) => s.origen !== "DOCUMENTO_EXTERNO");
        const siguientes = clinicas.length ? clinicas : conocidas;
        setOpciones(siguientes);
        if (!cobro && !sesionId) {
          const id = primeraLibre(siguientes)?.id;
          if (id) setElegidas([id]);
        }
      })
      .catch(() => {
        if (!activo) return;
        if (!conocidas.length) setErrorSesiones("No se pudieron cargar las sesiones de este paciente.");
      })
      .finally(() => {
        if (activo) setCargandoSesiones(false);
      });
    return () => {
      activo = false;
    };
  }, [open, cobro, fechaInicial, sesionId, pacienteId, sesiones]);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function field(key: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}) {
    const inputId = `cobro-${key}`;
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <Input
          id={inputId}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={Boolean(fieldErrors[key]) || undefined}
          {...props}
        />
        {fieldErrors[key] && <p className="text-xs text-destructive">{fieldErrors[key]}</p>}
      </div>
    );
  }

  function select(key: keyof FormState, label: string, options: Record<string, string>) {
    const inputId = `cobro-${key}`;
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <NativeSelect id={inputId} value={form[key]} onChange={(e) => set(key, e.target.value)}>
          {Object.entries(options).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </NativeSelect>
        {fieldErrors[key] && <p className="text-xs text-destructive">{fieldErrors[key]}</p>}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSaving(true);
    const body: Record<string, unknown> = {
      fecha_pago: form.fecha_pago,
      monto_bruto: parseInt(form.monto_bruto.replace(/\D/g, ""), 10) || 0,
      medio_pago: form.medio_pago,
      estado_pago: form.estado_pago,
      bhe_modo: form.bhe_modo,
      notas: form.notas,
    };
    // Glosa vacía al crear: el backend usa la glosa por defecto del perfil.
    if (form.glosa.trim() || editando) body.glosa = form.glosa.trim();
    body.sesiones = elegidas;
    if (!glosaBloqueada) body.glosa_incluye_sesion = incluirGlosa;
    if (editando) {
      for (const key of CAMPOS_RECEPTOR) body[key] = form[key].trim();
    } else {
      body.paciente = pacienteId;
    }
    try {
      const res = await apiFetch(editando ? `/facturacion/cobros/${cobro!.id}/` : "/facturacion/cobros/", {
        method: editando ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errors: Record<string, string> = {};
        let general = "";
        if (data && typeof data === "object") {
          for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            const message = Array.isArray(value) ? String(value[0]) : String(value);
            if (key in form) errors[key] = message;
            else if (key !== "code") general = message;
          }
        }
        setFieldErrors(errors);
        setError(general || (Object.keys(errors).length ? "Revisa los campos marcados." : "No se pudo guardar el cobro."));
        return;
      }
      onSaved(data);
      onOpenChange(false);
    } catch {
      setError("No se pudo guardar el cobro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cobro" : "Registrar cobro"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Los datos del receptor son una copia: cambiarlos aquí no modifica la ficha."
              : "Los datos del receptor se copian desde la ficha del paciente."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <fieldset className="space-y-2 rounded-xl border border-border/70 p-4">
            <legend className="px-1 text-sm font-semibold">Sesiones de este cobro</legend>
            {cargandoSesiones && opciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cargando sesiones...</p>
            ) : errorSesiones ? (
              <p className="text-sm text-destructive">{errorSesiones}</p>
            ) : (
              <SelectorSesiones
                opciones={opciones}
                elegidas={elegidas}
                cobroId={cobro?.id}
                onChange={setElegidas}
              />
            )}
            <label
              className="flex items-start gap-2 text-sm"
              title="La boleta la puede ver un tercero: el SII y quien la recibe. No incluye el contenido de la sesión."
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={incluirGlosa}
                disabled={glosaBloqueada}
                onChange={(e) => setIncluirGlosa(e.target.checked)}
              />
              <span>
                Incluir número y fecha de sesión en la glosa
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Apagado por defecto. La boleta la puede ver un tercero. Máximo 100 caracteres del SII.
                </span>
              </span>
            </label>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("fecha_pago", "Fecha de pago", { type: "date", required: true })}
            {field("monto_bruto", "Monto bruto (CLP)", { inputMode: "numeric", required: true, placeholder: "Ej: 35000" })}
            {select("medio_pago", "Medio de pago", MEDIOS_PAGO)}
            {select("estado_pago", "Estado del pago", { PAGADO: "Pagado", PENDIENTE: "Pendiente" })}
            {select("bhe_modo", "Retención", MODOS_BOLETA)}
            {field("glosa", "Glosa de la boleta", {
              placeholder: editando ? "" : "Por defecto, la de tu perfil",
              maxLength: 200,
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            La glosa no puede incluir diagnósticos ni términos clínicos: la boleta la ve el SII y quien la recibe.
          </p>
          {editando && (
            <fieldset className="grid gap-4 rounded-xl border border-border/70 p-4 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">Receptor de la boleta</legend>
              {select("receptor_tipo_doc", "Tipo de documento", { RUT: "RUT chileno", PASAPORTE: "Pasaporte", OTRO: "Otro documento" })}
              {field("receptor_documento", "Documento (RUT del paciente o del tutor)", {
                placeholder: "Ej: 12.345.678-9",
                onBlur: () =>
                  form.receptor_tipo_doc === "RUT" &&
                  form.receptor_documento &&
                  set("receptor_documento", formatRut(form.receptor_documento)),
              })}
              {field("receptor_nombre", "Nombre")}
              {field("receptor_email", "Correo", { type: "email" })}
              {field("receptor_direccion", "Dirección")}
              {field("receptor_comuna", "Comuna")}
            </fieldset>
          )}

          <div className="space-y-1.5">
            <label htmlFor="cobro-notas" className="text-sm font-medium">
              Notas internas
            </label>
            <Textarea id="cobro-notas" value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editando ? "Guardar cambios" : "Registrar cobro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
