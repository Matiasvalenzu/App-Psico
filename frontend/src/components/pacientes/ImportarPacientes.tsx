"use client";

import { useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";

const CAMPOS = [
  ["", "Ignorar"],
  ["nombre", "Nombre"],
  ["apellido", "Apellido"],
  ["rut", "RUT"],
  ["fecha_nacimiento", "Fecha de nacimiento"],
  ["edad", "Edad"],
  ["email", "Correo"],
  ["telefono", "Teléfono"],
  ["direccion", "Dirección"],
  ["comuna", "Comuna"],
  ["prevision", "Previsión"],
] as const;

type Fila = {
  fila: number;
  estado: "ok" | "advertencia" | "error";
  motivos: string[];
  duplicado: { tipo: string } | null;
};

export default function ImportarPacientes({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState<"archivo" | "mapeo" | "previa" | "resumen">("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [muestra, setMuestra] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [filas, setFilas] = useState<Fila[]>([]);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [decisiones, setDecisiones] = useState<Record<string, string>>({});
  const [resumen, setResumen] = useState<{ creados: number; actualizados: number; omitidos: number; errores_csv: string; id: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [avisoIa, setAvisoIa] = useState(false);

  function cerrar() {
    setOpen(false);
    setPaso("archivo");
    setArchivo(null);
    setResumen(null);
    setAvisoIa(false);
  }

  async function descargarPlantilla() {
    const res = await apiFetch("/pacientes/importar/plantilla/");
    if (!res.ok) return toast.error("No se pudo descargar la plantilla.");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-pacientes.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function form(extra?: Record<string, string>) {
    const body = new FormData();
    if (archivo) body.append("archivo", archivo);
    if (extra) for (const [k, v] of Object.entries(extra)) body.append(k, v);
    return body;
  }

  async function analizar() {
    if (!archivo) return;
    setBusy(true);
    try {
      const res = await apiFetch("/pacientes/importar/analizar/", { method: "POST", body: form() });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.error(data?.detail || "No se pudo leer el archivo.");
      setEncabezados(data.encabezados);
      setMuestra(data.muestra);
      setMapeo(data.mapeo);
      setPaso("mapeo");
    } finally {
      setBusy(false);
    }
  }

  async function sugerirIa() {
    setBusy(true);
    setAvisoIa(false);
    try {
      const res = await apiFetch("/pacientes/importar/sugerir/", {
        method: "POST",
        body: JSON.stringify({ encabezados, muestra: muestra.slice(0, 3) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.error(data?.detail || "No se pudo sugerir el mapeo.");
      setMapeo(data.mapeo);
    } finally {
      setBusy(false);
    }
  }

  async function previsualizar() {
    setBusy(true);
    try {
      const res = await apiFetch("/pacientes/importar/previsualizar/", {
        method: "POST",
        body: form({ mapeo: JSON.stringify(mapeo) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.error(data?.detail || "No se pudo previsualizar.");
      setFilas(data.filas);
      setIgnoradas(data.columnas_ignoradas || []);
      setPaso("previa");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar() {
    setBusy(true);
    try {
      const res = await apiFetch("/pacientes/importar/confirmar/", {
        method: "POST",
        body: form({ mapeo: JSON.stringify(mapeo), decisiones: JSON.stringify(decisiones) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.error(data?.detail || "No se pudo importar.");
      setResumen(data);
      setPaso("resumen");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  function descargarErrores() {
    if (!resumen?.errores_csv) return;
    const url = URL.createObjectURL(new Blob([resumen.errores_csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "errores-importacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendientes = filas.filter((f) => f.duplicado && f.duplicado.tipo !== "conflicto" && f.estado !== "error");
  const faltaDecision = pendientes.some((f) => !decisiones[String(f.fila)]);

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Importar pacientes
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : cerrar())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar pacientes</DialogTitle>
            <DialogDescription>
              Solo se importan datos de contacto y administrativos. Las notas clínicas se ignoran y el archivo no se guarda.
            </DialogDescription>
          </DialogHeader>
          {paso === "archivo" && (
            <div className="space-y-3">
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={descargarPlantilla}>
                <Download className="h-4 w-4" />
                Descargar plantilla .xlsx
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
              <p className="text-xs text-muted-foreground">.xlsx, .xls o .csv, hasta 5 MB y 1.000 filas.</p>
            </div>
          )}
          {paso === "mapeo" && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {encabezados.map((nombre, i) => (
                <label key={i} className="grid grid-cols-2 items-center gap-2 text-sm">
                  <span className="truncate">{nombre || `Columna ${i + 1}`}</span>
                  <NativeSelect value={mapeo[String(i)] || ""} onChange={(e) => setMapeo((prev) => ({ ...prev, [String(i)]: e.target.value }))}>
                    {CAMPOS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
              {avisoIa ? (
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Se enviarán solo los encabezados y 3 filas de muestra, sin el resto del archivo.
                  <Button type="button" size="sm" className="ml-2" onClick={sugerirIa} disabled={busy}>Enviar</Button>
                </p>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAvisoIa(true)}>Sugerir con IA</Button>
              )}
            </div>
          )}
          {paso === "previa" && (
            <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {ignoradas.length > 0 && <p className="text-xs text-muted-foreground">Columnas ignoradas: {ignoradas.join(", ")}</p>}
              {filas.map((fila) => (
                <div key={fila.fila} className="rounded-lg border border-border/70 px-3 py-2">
                  <p>
                    Fila {fila.fila}: {fila.estado === "ok" ? "OK" : fila.estado === "advertencia" ? "Advertencia" : "Error"}
                    {fila.motivos.length ? ` — ${fila.motivos.join(" ")}` : ""}
                  </p>
                  {fila.duplicado && fila.duplicado.tipo !== "conflicto" && fila.estado !== "error" && (
                    <NativeSelect value={decisiones[String(fila.fila)] || ""} onChange={(e) => setDecisiones((prev) => ({ ...prev, [String(fila.fila)]: e.target.value }))}>
                      <option value="">Elegir</option>
                      <option value="saltar">Saltar</option>
                      <option value="actualizar">Actualizar datos de contacto</option>
                    </NativeSelect>
                  )}
                </div>
              ))}
            </div>
          )}
          {paso === "resumen" && resumen && (
            <div className="space-y-2 text-sm">
              <p>Creados: {resumen.creados}. Actualizados: {resumen.actualizados}. Omitidos: {resumen.omitidos}.</p>
              <p className="text-xs text-muted-foreground">Puedes deshacer esta importación durante 24 horas.</p>
              {resumen.errores_csv.trim().split("\n").length > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={descargarErrores}>Descargar CSV de errores</Button>
              )}
            </div>
          )}
          <DialogFooter>
            {paso === "archivo" && <Button onClick={analizar} disabled={!archivo || busy}>{busy && <Loader2 className="animate-spin" />}Continuar</Button>}
            {paso === "mapeo" && <Button onClick={previsualizar} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Ver vista previa</Button>}
            {paso === "previa" && <Button onClick={confirmar} disabled={busy || faltaDecision}>{busy && <Loader2 className="animate-spin" />}Confirmar importación</Button>}
            {paso === "resumen" && <Button onClick={cerrar}>Cerrar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
