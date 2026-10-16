"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, FileSignature, Loader2, Lock, RefreshCw, Sparkles, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import UpsellPlusModal from "@/components/suscripcion/UpsellPlusModal";
import { API_SEG, TIPOS_INFORME, fechaCorta, normalizarDocumento, type DocumentoIA } from "@/lib/seguimiento";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || "No se pudo completar la acción.");
  return data as T;
}

function usePolling() {
  const activo = useRef(true);
  useEffect(() => () => { activo.current = false; }, []);
  return useCallback(async (id: number) => {
    for (let i = 0; i < 45 && activo.current; i++) {
      const d = await json<DocumentoIA>(await apiFetch(`${API_SEG}/documentos/${id}/`));
      if (d.estado !== "PENDIENTE") return d;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Está tardando más de lo normal. El documento puede seguir generándose; vuelve a revisar en unos segundos.");
  }, []);
}

async function descargar(id: number, formato: "pdf" | "docx", nombre: string) {
  const r = await apiFetch(`${API_SEG}/documentos/${id}/exportar/${formato}/`);
  if (!r.ok) return toast.error("No se pudo exportar.");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.${formato}`;
  a.click();
  URL.revokeObjectURL(url);
}

function resaltar(texto: string) {
  return texto.split(/(\[(?:COMPLETAR|CÓDIGO CIE-10 NO DISPONIBLE)[^\]]*\])/g).map((parte, i) =>
    /^\[(COMPLETAR|CÓDIGO)/.test(parte) ? <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700/60">{parte}</mark> : parte,
  );
}

function Brief({ pacienteId }: { pacienteId: string }) {
  const [brief, setBrief] = useState<DocumentoIA | null>(null);
  const [generando, setGenerando] = useState(false);
  const poll = usePolling();

  useEffect(() => {
    apiFetch(`${API_SEG}/pacientes/${pacienteId}/brief/`).then((r) => json<unknown>(r)).then((d) => setBrief(normalizarDocumento(d))).catch(() => {});
  }, [pacienteId]);

  async function generar() {
    setGenerando(true);
    try {
      const d = await json<DocumentoIA>(await apiFetch(`${API_SEG}/pacientes/${pacienteId}/brief/`, { method: "POST" }));
      setBrief(normalizarDocumento(await poll(d.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo solicitar el brief.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <section className="rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Brief de sesión</h3>
          <p className="text-sm text-muted-foreground">Dónde quedó el proceso, en un minuto. Reúne las últimas sesiones, las escalas, las tareas y el ánimo. No incluye datos de cobros.</p>
        </div>
        <Button onClick={generar} disabled={generando}>{generando ? <Loader2 className="animate-spin" /> : <Zap />} {brief ? "Regenerar" : "Generar brief"}</Button>
      </div>
      {generando && <p className="mt-3 text-sm text-muted-foreground">Generando el brief… puede tardar unos segundos.</p>}
      {brief && !generando && (
        <div className="mt-4 space-y-3">
          {brief.estado === "ERROR" ? (
            <Alert variant="destructive"><AlertTitle>No se pudo generar el brief</AlertTitle><AlertDescription>{brief.error}</AlertDescription></Alert>
          ) : (
            <>
              <Alert><Sparkles /><AlertTitle>Borrador generado por IA</AlertTitle><AlertDescription>Revísalo antes de usarlo. Es un apoyo para preparar la sesión, no una valoración clínica.</AlertDescription></Alert>
              {(brief.advertencias ?? []).length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{brief.advertencias.map((a) => <li key={a}>{a}</li>)}</ul>}
              <div className="whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">{brief.contenido}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Generado el {fechaCorta(brief.updated_at)}
                <Button size="xs" variant="ghost" onClick={() => { navigator.clipboard.writeText(brief.contenido); toast.success("Copiado"); }}><Copy /> Copiar</Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Diagnostico({ pacienteId }: { pacienteId: string }) {
  const [diag, setDiag] = useState({ codigo: "", descripcion: "", presuntivo: true });
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<{ codigo: string; descripcion: string }[]>([]);
  useEffect(() => {
    apiFetch(`${API_SEG}/pacientes/${pacienteId}/diagnostico/`).then((r) => json<typeof diag>(r)).then(setDiag).catch(() => {});
  }, [pacienteId]);
  useEffect(() => {
    if (q.length < 2) return setOpciones([]);
    const t = setTimeout(() => apiFetch(`${API_SEG}/cie10/?q=${encodeURIComponent(q)}`).then((r) => json<typeof opciones>(r)).then(setOpciones).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function guardar(nuevo: typeof diag) {
    try {
      setDiag(await json<typeof diag>(await apiFetch(`${API_SEG}/pacientes/${pacienteId}/diagnostico/`, { method: "PUT", body: JSON.stringify(nuevo) })));
      setQ("");
      setOpciones([]);
      toast.success("Diagnóstico guardado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }
  return (
    <div className="rounded-xl border p-3 text-sm">
      <div className="mb-2 font-medium">Diagnóstico (CIE-10)</div>
      {diag.codigo ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-2 py-0.5 font-mono">{diag.codigo}</span> {diag.descripcion}
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={diag.presuntivo} onChange={(e) => guardar({ ...diag, presuntivo: e.target.checked })} /> Presuntivo</label>
          <Button size="xs" variant="ghost" onClick={() => guardar({ codigo: "", descripcion: "", presuntivo: true })}>Quitar</Button>
        </div>
      ) : <p className="text-xs text-muted-foreground">Sin diagnóstico registrado. Es necesario para el informe de licencia médica.</p>}
      <Input className="mt-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o descripción (ej. F41.1, ansiedad)" />
      {opciones.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border">
          {opciones.map((o) => (
            <li key={o.codigo}><button type="button" className="w-full px-2 py-1 text-left hover:bg-muted" onClick={() => guardar({ ...o, presuntivo: true })}><span className="font-mono">{o.codigo}</span> {o.descripcion}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GeneradorInformes({ pacienteId }: { pacienteId: string }) {
  const [tipo, setTipo] = useState(TIPOS_INFORME[0].value);
  const [destinatario, setDestinatario] = useState("");
  const [contexto, setContexto] = useState("");
  const [generando, setGenerando] = useState(false);
  const [informes, setInformes] = useState<DocumentoIA[]>([]);
  const [actual, setActual] = useState<DocumentoIA | null>(null);
  const [texto, setTexto] = useState("");
  const poll = usePolling();

  const cargar = useCallback(() => {
    apiFetch(`${API_SEG}/pacientes/${pacienteId}/informes/`).then((r) => json<unknown>(r)).then((l) => setInformes(Array.isArray(l) ? l.map(normalizarDocumento).filter((d): d is DocumentoIA => d !== null) : [])).catch(() => {});
  }, [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setTexto(actual?.contenido ?? ""); }, [actual]);

  async function generar(regenerarId?: number) {
    setGenerando(true);
    try {
      const d = regenerarId
        ? await json<DocumentoIA>(await apiFetch(`${API_SEG}/documentos/${regenerarId}/regenerar/`, { method: "POST" }))
        : await json<DocumentoIA>(await apiFetch(`${API_SEG}/pacientes/${pacienteId}/informes/`, { method: "POST", body: JSON.stringify({ tipo, destinatario, contexto_adicional: contexto }) }));
      setActual(d);
      setActual(normalizarDocumento(await poll(d.id)));
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el borrador.");
    } finally {
      setGenerando(false);
    }
  }

  async function guardar() {
    if (!actual) return;
    try {
      setActual(await json<DocumentoIA>(await apiFetch(`${API_SEG}/documentos/${actual.id}/`, { method: "PATCH", body: JSON.stringify({ contenido: texto }) })));
      toast.success("Cambios guardados");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  async function finalizar() {
    if (!actual || !confirm("Revisé el contenido y asumo la responsabilidad profesional del informe. ¿Marcar como final?")) return;
    await guardar();
    try {
      setActual(await json<DocumentoIA>(await apiFetch(`${API_SEG}/documentos/${actual.id}/finalizar/`, { method: "POST" })));
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo finalizar.");
    }
  }

  const pendientesCompletar = (texto.match(/\[COMPLETAR/g) ?? []).length;
  const nombreArchivo = actual ? `${actual.tipo_label}`.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-") : "informe";

  return (
    <section className="rounded-2xl border p-4 sm:p-5">
      <h3 className="font-semibold">Generador de informes</h3>
      <p className="mb-4 text-sm text-muted-foreground">Borrador a partir de la ficha, las sesiones, las escalas y el seguimiento. Tú lo revisas, lo corriges y lo firmas.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Tipo de informe
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
              {TIPOS_INFORME.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <span className="text-xs font-normal text-muted-foreground">{TIPOS_INFORME.find((t) => t.value === tipo)?.hint}</span>
          </label>
          <label className="block text-sm font-medium">Destinatario
            <Input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Ej: Profesora jefe, Colegio…" maxLength={255} />
          </label>
          <label className="block text-sm font-medium">Contexto adicional (opcional)
            <Textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={4} maxLength={4000} placeholder="Quién lo solicita, motivo, RIT, curso, datos que no están en la ficha…" />
            <span className="text-xs font-normal text-muted-foreground">Se envía como información del caso, no como instrucciones a la IA.</span>
          </label>
          <Button onClick={() => generar()} disabled={generando}>{generando ? <Loader2 className="animate-spin" /> : <FileSignature />} Generar borrador</Button>
        </div>
        <Diagnostico pacienteId={pacienteId} />
      </div>

      {generando && <p className="mt-4 text-sm text-muted-foreground">Redactando el borrador… puede tardar unos segundos.</p>}

      {actual && !generando && (
        <div className="mt-5 space-y-3">
          {actual.estado === "ERROR" && <Alert variant="destructive"><AlertTitle>No se pudo generar</AlertTitle><AlertDescription>{actual.error}</AlertDescription></Alert>}
          {actual.estado === "LISTO" && (
            <>
              <Alert>
                <Sparkles />
                <AlertTitle>{actual.es_borrador ? "Borrador generado por IA — revísalo antes de usarlo" : `Informe final (${fechaCorta(actual.finalizado_en)})`}</AlertTitle>
                <AlertDescription>
                  {actual.es_borrador && <p>No es un documento terminado. Verifica cada dato clínico, completa lo marcado como [COMPLETAR] y corrige lo que corresponda: la responsabilidad profesional del informe es tuya.</p>}
                  {(actual.advertencias ?? []).length > 0 && <ul className="mt-1 list-disc pl-5">{actual.advertencias.map((a) => <li key={a}>{a}</li>)}</ul>}
                </AlertDescription>
              </Alert>
              <div className="text-xs text-muted-foreground">{actual.tipo_label}{actual.destinatario ? ` · ${actual.destinatario}` : ""} · {pendientesCompletar} campos por completar</div>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={18} className="font-mono text-xs" />
              <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Vista previa con campos resaltados</summary><div className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/40 p-3">{resaltar(texto)}</div></details>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={guardar}>Guardar</Button>
                {actual.es_borrador && <Button size="sm" variant="outline" onClick={finalizar}>Marcar como final</Button>}
                {actual.es_borrador && <Button size="sm" variant="ghost" onClick={() => generar(actual.id)}><RefreshCw /> Regenerar</Button>}
                <Button size="sm" variant="outline" onClick={() => descargar(actual.id, "pdf", nombreArchivo)}><Download /> PDF</Button>
                <Button size="sm" variant="outline" onClick={() => descargar(actual.id, "docx", nombreArchivo)}><Download /> Word</Button>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(texto); toast.success("Copiado"); }}><Copy /> Copiar</Button>
              </div>
            </>
          )}
        </div>
      )}

      {informes.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Informes guardados</h4>
          <ul className="divide-y text-sm">
            {informes.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <button className="text-left hover:underline" onClick={() => setActual(d)}>
                  {d.tipo_label}{d.destinatario ? ` · ${d.destinatario}` : ""} <span className="text-xs text-muted-foreground">· {fechaCorta(d.created_at)}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.es_borrador ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>{d.estado === "ERROR" ? "Error" : d.es_borrador ? "Borrador" : "Final"}</span>
                  <Button size="icon-xs" variant="ghost" aria-label="Eliminar informe" onClick={async () => { if (confirm("¿Eliminar este informe?")) { await apiFetch(`${API_SEG}/documentos/${d.id}/`, { method: "DELETE" }); if (actual?.id === d.id) setActual(null); cargar(); } }}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BloqueoPlus({ enPrueba }: { enPrueba: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border p-6 text-center">
      <Lock className="mx-auto mb-2 size-6 text-muted-foreground" />
      <h3 className="font-semibold">Brief previo a la sesión e informes con IA</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Un resumen de un minuto antes de cada sesión y borradores de informe para colegio, Tribunal de Familia, licencia médica, avance y derivación, con CIE-10 y exportación a PDF o Word. Disponible en el Plan Plus.</p>
      <Button className="mt-4" variant="outline" onClick={() => setOpen(true)}><Lock /> Conocer el Plan Plus</Button>
      <UpsellPlusModal open={open} onOpenChange={setOpen} origen="informes_ficha" enPrueba={enPrueba} />
    </section>
  );
}

export default function BriefInformes({ pacienteId, plus, enPrueba = false }: { pacienteId: string; plus: boolean; enPrueba?: boolean }) {
  if (!plus) return <BloqueoPlus enPrueba={enPrueba} />;
  return (
    <div className="space-y-6">
      <Brief pacienteId={pacienteId} />
      <GeneradorInformes pacienteId={pacienteId} />
    </div>
  );
}
