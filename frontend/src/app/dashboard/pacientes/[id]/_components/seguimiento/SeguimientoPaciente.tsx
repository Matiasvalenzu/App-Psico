"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_SEG, colorAnimo, etiquetaAnimo, fechaCorta, type Animo, type Tarea } from "@/lib/seguimiento";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || "No se pudo completar la acción.");
  return data as T;
}

function GraficoAnimo({ registros }: { registros: Animo[] }) {
  const orden = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (orden.length < 2) return null;
  const W = 600, H = 140, P = 20;
  const t0 = new Date(orden[0].fecha).getTime();
  const t1 = new Date(orden[orden.length - 1].fecha).getTime() || t0 + 1;
  const x = (f: string) => P + ((new Date(f).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - 1) / 9) * (H - 2 * P);
  const linea = (origen: string) => orden.filter((r) => r.registrado_por === origen).map((r) => `${x(r.fecha)},${y(r.valor)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de registro de ánimo">
      {[1, 5, 10].map((v) => <line key={v} x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.1} />)}
      <polyline points={linea("PACIENTE")} fill="none" stroke="#6366f1" strokeWidth={2} />
      <polyline points={linea("PSICOLOGO")} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" />
      {orden.map((r) => (
        <circle key={r.id} cx={x(r.fecha)} cy={y(r.valor)} r={4} fill={colorAnimo(r.valor)}>
          <title>{`${fechaCorta(r.fecha)}: ${r.valor} (${r.etiqueta}) · ${r.registrado_por === "PACIENTE" ? "paciente" : "profesional"}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function SeguimientoPaciente({ pacienteId }: { pacienteId: string }) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [animo, setAnimo] = useState<Animo[]>([]);
  const [portal, setPortal] = useState<{ activo: boolean; expira_en: string | null; ultimo_acceso: string | null; enlace?: string; mensaje?: string; whatsapp_url?: string }>({ activo: false, expira_en: null, ultimo_acceso: null });
  const [cargando, setCargando] = useState(true);
  const [desc, setDesc] = useState("");
  const [entrega, setEntrega] = useState("");
  const [visible, setVisible] = useState(true);
  const [mostrarAnimo, setMostrarAnimo] = useState(false);
  const [valor, setValor] = useState(5);
  const [nota, setNota] = useState("");
  const [dias, setDias] = useState(30);

  const cargar = useCallback(async () => {
    try {
      const [t, a, p] = await Promise.all([
        apiFetch(`${API_SEG}/pacientes/${pacienteId}/tareas/`).then((r) => json<Tarea[]>(r)),
        apiFetch(`${API_SEG}/pacientes/${pacienteId}/animo/?dias=${dias}`).then((r) => json<Animo[]>(r)),
        apiFetch(`${API_SEG}/pacientes/${pacienteId}/portal/`).then((r) => json<typeof portal>(r)),
      ]);
      setTareas(t);
      setAnimo(a);
      setPortal((prev) => ({ ...p, enlace: prev.enlace, mensaje: prev.mensaje, whatsapp_url: prev.whatsapp_url }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el seguimiento.");
    } finally {
      setCargando(false);
    }
  }, [pacienteId, dias]);

  useEffect(() => { cargar(); }, [cargar]);

  async function llamar(url: string, metodo: string, body?: unknown) {
    try {
      const r = await apiFetch(url, { method: metodo, body: body ? JSON.stringify(body) : undefined });
      const data = r.status === 204 ? null : await json<unknown>(r);
      await cargar();
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción.");
      return null;
    }
  }

  const pendientes = tareas.filter((t) => !t.completada);
  const completadas = tareas.filter((t) => t.completada);
  const ultimos7 = animo.filter((a) => new Date(a.fecha) >= new Date(Date.now() - 7 * 864e5));
  const promedio7 = ultimos7.length ? (ultimos7.reduce((s, a) => s + a.valor, 0) / ultimos7.length).toFixed(1) : null;

  if (cargando) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Cargando seguimiento…</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border p-4 sm:p-5">
        <h3 className="font-semibold">Enlace del paciente</h3>
        <p className="mb-3 text-sm text-muted-foreground">Tu paciente podrá marcar sus tareas y registrar cómo se siente entre sesiones. No verá tus notas, sesiones ni escalas. Psiconex no envía nada automáticamente.</p>
        {portal.activo ? (
          <div className="space-y-2 text-sm">
            <p>Enlace activo hasta el {fechaCorta(portal.expira_en)}{portal.ultimo_acceso ? ` · último acceso ${fechaCorta(portal.ultimo_acceso)}` : " · aún sin acceso"}.</p>
            {portal.mensaje && <p className="rounded-lg bg-muted p-3">{portal.mensaje}</p>}
            <div className="flex flex-wrap gap-2">
              {portal.mensaje && <Button size="sm" onClick={() => { navigator.clipboard.writeText(portal.mensaje ?? ""); toast.success("Mensaje copiado"); }}><Copy /> Copiar</Button>}
              {portal.whatsapp_url && <Button size="sm" variant="outline" onClick={() => window.open(portal.whatsapp_url, "_blank", "noopener")}><ExternalLink /> Abrir WhatsApp</Button>}
              <Button size="sm" variant="outline" onClick={async () => { const d = await llamar(`${API_SEG}/pacientes/${pacienteId}/portal/`, "POST"); if (d) setPortal((p) => ({ ...p, ...(d as object) })); }}>Generar enlace nuevo</Button>
              <Button size="sm" variant="ghost" onClick={() => llamar(`${API_SEG}/pacientes/${pacienteId}/portal/`, "DELETE").then(() => setPortal({ activo: false, expira_en: null, ultimo_acceso: null }))}>Desactivar</Button>
            </div>
            {!portal.mensaje && <p className="text-xs text-muted-foreground">Por seguridad el enlace solo se muestra al generarlo. Si lo perdiste, genera uno nuevo (el anterior deja de funcionar).</p>}
          </div>
        ) : (
          <Button size="sm" onClick={async () => { const d = await llamar(`${API_SEG}/pacientes/${pacienteId}/portal/`, "POST"); if (d) setPortal((p) => ({ ...p, ...(d as object) })); }}>Generar enlace</Button>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border p-4 sm:p-5">
          <h3 className="font-semibold">Tareas intersesión</h3>
          <p className="mb-3 text-sm text-muted-foreground">Encargos entre una sesión y la siguiente.</p>
          <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!desc.trim()) return; await llamar(`${API_SEG}/pacientes/${pacienteId}/tareas/`, "POST", { descripcion: desc, fecha_entrega: entrega || null, visible_para_paciente: visible }); setDesc(""); setEntrega(""); }}>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: Registrar pensamientos automáticos cada noche" maxLength={1000} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">Entrega <Input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className="w-40" /></label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible para el paciente</label>
              <Button size="sm" type="submit" disabled={!desc.trim()}><Plus /> Guardar tarea</Button>
            </div>
          </form>
          <h4 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Pendientes ({pendientes.length})</h4>
          <ul className="divide-y text-sm">
            {pendientes.map((t) => (
              <li key={t.id} className="flex items-start gap-2 py-2">
                <input type="checkbox" aria-label="Marcar como completada" className="mt-1" onChange={() => llamar(`${API_SEG}/tareas/${t.id}/completar/`, "POST", { nota: prompt("Nota del paciente sobre esta tarea (opcional)") ?? undefined })} />
                <div className="flex-1">
                  <div>{t.descripcion}</div>
                  <div className={`text-xs ${t.vencida ? "text-red-600" : "text-muted-foreground"}`}>
                    {t.sesion_fecha ? `Asignada el ${fechaCorta(t.sesion_fecha)}` : "Sin sesión asociada"}
                    {t.fecha_entrega ? ` · Entrega ${fechaCorta(t.fecha_entrega)}${t.vencida ? " — vencida" : ""}` : ""}
                    {t.visible_para_paciente === false ? " · solo visible para ti" : ""}
                  </div>
                </div>
                <Button size="icon-xs" variant="ghost" aria-label="Eliminar tarea" onClick={() => confirm("¿Eliminar la tarea?") && llamar(`${API_SEG}/tareas/${t.id}/`, "DELETE")}><Trash2 /></Button>
              </li>
            ))}
            {!pendientes.length && <li className="py-2 text-muted-foreground">Sin tareas pendientes.</li>}
          </ul>
          <h4 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Completadas ({completadas.length})</h4>
          <ul className="divide-y text-sm">
            {completadas.map((t) => (
              <li key={t.id} className="py-2">
                <div className="line-through opacity-70">{t.descripcion}</div>
                {t.nota_paciente && <div className="text-xs italic">“{t.nota_paciente}”</div>}
                <div className="text-xs text-muted-foreground">Completada el {fechaCorta(t.completada_en)} por {t.completada_por === "PACIENTE" ? "el paciente" : "ti"}
                  <button className="ml-2 underline" onClick={() => llamar(`${API_SEG}/tareas/${t.id}/`, "PATCH", { completada: false })}>Reabrir</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Registro de ánimo</h3>
              <p className="text-sm text-muted-foreground">Escala 1–10{promedio7 ? ` · promedio últimos 7 días: ${promedio7}` : ""}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setMostrarAnimo((v) => !v)}>Registrar</Button>
          </div>
          {mostrarAnimo && (
            <div className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3">
              <div className="text-sm">Ánimo: <strong>{valor} — {etiquetaAnimo(valor)}</strong></div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                  <button key={v} type="button" onClick={() => setValor(v)} aria-pressed={valor === v}
                    className={`size-9 rounded-lg text-sm font-semibold text-white ${valor === v ? "ring-2 ring-offset-2 ring-primary" : ""}`} style={{ background: colorAnimo(v) }}>{v}</button>
                ))}
              </div>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Contexto del registro (opcional)" maxLength={500} />
              <div className="flex gap-2">
                <Button size="sm" onClick={async () => { await llamar(`${API_SEG}/pacientes/${pacienteId}/animo/`, "POST", { valor, nota }); setMostrarAnimo(false); setNota(""); }}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setMostrarAnimo(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-1 text-xs">
            {[30, 60, 90].map((d) => <button key={d} onClick={() => setDias(d)} className={`rounded-full border px-2 py-0.5 ${dias === d ? "border-primary bg-primary/10" : ""}`}>{d} días</button>)}
            <span className="ml-auto text-muted-foreground">— paciente · - - profesional</span>
          </div>
          <GraficoAnimo registros={animo} />
          <ul className="mt-2 max-h-72 divide-y overflow-y-auto text-sm">
            {animo.slice(0, 30).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-md font-semibold text-white" style={{ background: colorAnimo(a.valor) }}>{a.valor}</span>
                <div className="flex-1">
                  <div>{a.etiqueta}{a.emociones.length ? ` · ${a.emociones.join(", ")}` : ""}</div>
                  {a.nota && <div className="text-xs italic">“{a.nota}”</div>}
                  <div className="text-xs text-muted-foreground">{fechaCorta(a.fecha)} · {a.registrado_por === "PACIENTE" ? "registrado por el paciente" : "registrado por ti"}</div>
                </div>
                <Button size="icon-xs" variant="ghost" aria-label="Eliminar registro" onClick={() => confirm("¿Eliminar el registro?") && llamar(`${API_SEG}/animo/${a.id}/`, "DELETE")}><Trash2 /></Button>
              </li>
            ))}
            {!animo.length && <li className="py-2 text-muted-foreground">Sin registros de ánimo.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
