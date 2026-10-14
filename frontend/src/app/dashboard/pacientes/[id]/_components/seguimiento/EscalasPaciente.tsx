"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, Copy, ExternalLink, Link2, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CuestionarioLikert from "@/components/seguimiento/CuestionarioLikert";
import { API_SEG, colorSeveridad, fechaCorta, type Aplicacion, type Escala, type ResultadoEscala, type SerieTrayectoria } from "@/lib/seguimiento";
import TrayectoriaChart from "./TrayectoriaChart";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || "No se pudo completar la acción.");
  return data as T;
}

function ResultadoVista({ escala, r }: { escala?: Escala; r: ResultadoEscala }) {
  return (
    <div className="space-y-3">
      {r.alertas_riesgo.map((a) => (
        <Alert key={a.pregunta_id} variant="destructive">
          <ShieldAlert />
          <AlertTitle>Indicador de riesgo — {a.etiqueta}</AlertTitle>
          <AlertDescription>
            <p>«{a.texto}» Respuesta: <strong>{a.opcion}</strong> (valor {a.valor}).</p>
            <p>Este indicador es independiente del puntaje total y de la banda de severidad. Evalúa según tu criterio clínico y tu protocolo.</p>
          </AlertDescription>
        </Alert>
      ))}
      {r.subescalas.length ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {r.subescalas.map((s) => (
            <div key={s.clave} className="rounded-xl border p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: colorSeveridad(s.severidad) }}>{s.puntaje}</div>
              <div className="text-sm font-medium">{s.nombre}</div>
              <div className="text-xs text-muted-foreground">{s.etiqueta}</div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-3">Cada subescala se interpreta por separado con sus propios puntos de corte; el DASS-21 no entrega un puntaje total.</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ background: colorSeveridad(r.severidad) }}>{r.total}</div>
          <div>
            <div className="font-semibold">{r.etiqueta}</div>
            <div className="text-xs text-muted-foreground">Rango {escala?.min ?? 0}–{escala?.max}</div>
          </div>
        </div>
      )}
      {r.item_funcional && <p className="text-sm">Dificultad funcional: <strong>{r.item_funcional}</strong></p>}
      {escala && <p className="text-xs text-muted-foreground">Instrumento de tamizaje, no diagnóstico. {escala.referencia}</p>}
    </div>
  );
}

export default function EscalasPaciente({ pacienteId, tieneTelefono }: { pacienteId: string; tieneTelefono: boolean }) {
  const [catalogo, setCatalogo] = useState<Escala[]>([]);
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([]);
  const [series, setSeries] = useState<SerieTrayectoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState<Escala | null>(null);
  const [editando, setEditando] = useState<Aplicacion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Aplicacion | null>(null);
  const [enlace, setEnlace] = useState<Aplicacion | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [c, a, t] = await Promise.all([
        apiFetch(`${API_SEG}/escalas/catalogo/`).then((r) => json<Escala[]>(r)),
        apiFetch(`${API_SEG}/pacientes/${pacienteId}/escalas/`).then((r) => json<Aplicacion[]>(r)),
        apiFetch(`${API_SEG}/pacientes/${pacienteId}/trayectoria/`).then((r) => json<{ escalas: SerieTrayectoria[] }>(r)),
      ]);
      setCatalogo(c);
      setAplicaciones(a);
      setSeries(t.escalas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las escalas.");
    } finally {
      setCargando(false);
    }
  }, [pacienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const escalaDe = (slug: string) => catalogo.find((e) => e.slug === slug);

  async function guardarEnConsulta(respuestas: Record<string, number>) {
    setEnviando(true);
    try {
      const res = editando
        ? await apiFetch(`${API_SEG}/escalas/aplicaciones/${editando.id}/`, { method: "PATCH", body: JSON.stringify({ respuestas }) })
        : await apiFetch(`${API_SEG}/pacientes/${pacienteId}/escalas/`, { method: "POST", body: JSON.stringify({ escala: aplicando?.slug, canal: "EN_CONSULTA", respuestas }) });
      const a = await json<Aplicacion>(res);
      setAplicando(null);
      setEditando(null);
      setResultado(a);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  async function crearEnlace(slug: string) {
    try {
      const a = await json<Aplicacion>(await apiFetch(`${API_SEG}/pacientes/${pacienteId}/escalas/`, { method: "POST", body: JSON.stringify({ escala: slug, canal: "ENLACE" }) }));
      setEnlace(a);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el enlace.");
    }
  }

  async function accion(url: string, metodo = "POST") {
    try {
      const r = await apiFetch(url, { method: metodo });
      if (!r.ok && r.status !== 204) await json(r);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción.");
    }
  }

  const alertas = aplicaciones.filter((a) => a.alerta_riesgo && !a.alerta_revisada_en);

  if (cargando) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Cargando escalas…</div>;

  return (
    <div className="space-y-6">
      {alertas.map((a) => (
        <Alert key={a.id} variant="destructive">
          <AlertTriangle />
          <AlertTitle>Indicador de riesgo en {a.nombre} ({fechaCorta(a.completada_en)})</AlertTitle>
          <AlertDescription>
            {"alertas_riesgo" in a.resultado && a.resultado.alertas_riesgo.map((x) => (
              <p key={x.pregunta_id}>«{x.texto}» — {x.opcion} (valor {x.valor}){x.validada ? "" : " · indicador complementario no validado"}.</p>
            ))}
            <p>Este indicador es independiente del puntaje total. Evalúa según tu criterio clínico y tu protocolo; si corresponde, actualiza el riesgo en los datos del paciente.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => accion(`${API_SEG}/escalas/aplicaciones/${a.id}/revisar-alerta/`)}>Marcar como revisada</Button>
          </AlertDescription>
        </Alert>
      ))}

      <section className="rounded-2xl border p-4 sm:p-5">
        <h3 className="font-semibold">Escalas clínicas validadas</h3>
        <p className="mb-4 text-sm text-muted-foreground">Aplícalas en consulta o comparte un enlace para que el paciente responda desde su celular. El mensaje no dice qué escala es.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalogo.map((e) => (
            <div key={e.slug} className="flex flex-col justify-between gap-3 rounded-xl border p-3">
              <div>
                <div className="font-medium">{e.nombre} <span className="text-xs font-normal text-muted-foreground">· {e.dominio} · ~{e.duracion_min} min</span></div>
                <div className="text-xs text-muted-foreground">{e.nombre_largo}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAplicando(e)}><ClipboardCheck /> Aplicar ahora</Button>
                <Button size="sm" variant="outline" onClick={() => crearEnlace(e.slug)}><Link2 /> Enlace para el paciente</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border p-4 sm:p-5">
        <h3 className="mb-3 font-semibold">Trayectoria</h3>
        {series.length ? <TrayectoriaChart series={series} /> : <p className="text-sm text-muted-foreground">Aún no se ha aplicado ninguna escala. Aplica una para empezar a construir la trayectoria.</p>}
        {series.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {series.map((s) => {
              const ult = s.puntos[s.puntos.length - 1];
              const pri = s.puntos[0];
              const delta = s.subescalas?.length || ult.total === null || pri.total === null ? null : ult.total - pri.total;
              const mejora = delta !== null && (s.mayor_es_mejor ? delta > 0 : delta < 0);
              return (
                <div key={s.slug} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{s.nombre}</strong>
                    <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: colorSeveridad(ult.severidad) }}>{ult.etiqueta}</span>
                  </div>
                  {delta !== null && s.puntos.length > 1 && (
                    <div className={mejora ? "text-emerald-600" : delta === 0 ? "text-muted-foreground" : "text-red-600"}>
                      {delta > 0 ? "+" : ""}{delta} ({delta === 0 ? "sin cambio" : mejora ? "mejora" : "empeora"}) desde la primera aplicación
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">Última: {fechaCorta(ult.fecha)} · {s.puntos.length} aplicaciones</div>
                  {ult.alerta_riesgo && <div className="mt-1 text-xs font-medium text-red-700">⚠ Indicador de riesgo en la última aplicación</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border p-4 sm:p-5">
        <h3 className="mb-3 font-semibold">Aplicaciones y envíos</h3>
        {!aplicaciones.length && <p className="text-sm text-muted-foreground">Sin aplicaciones todavía.</p>}
        <ul className="divide-y text-sm">
          {aplicaciones.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <strong>{a.nombre}</strong>{" "}
                <span className="text-muted-foreground">
                  {a.estado === "COMPLETADA" && `· respondida el ${fechaCorta(a.completada_en)} · ${a.puntaje_total ?? ""} ${"etiqueta" in a.resultado ? a.resultado.etiqueta : ""}`}
                  {a.estado === "PENDIENTE" && (a.vencida ? "· enlace vencido" : `· enlace enviado · vence el ${fechaCorta(a.expira_en)}`)}
                  {a.estado === "CANCELADA" && "· cancelada"}
                  {a.canal === "EN_CONSULTA" ? " · en consulta" : ""}
                </span>
                {a.alerta_riesgo && <span className="ml-2 text-xs font-semibold text-red-700">⚠ Riesgo</span>}
              </div>
              <div className="flex gap-1">
                {a.estado === "COMPLETADA" && <Button size="xs" variant="outline" onClick={() => setResultado(a)}>Ver</Button>}
                {a.estado === "COMPLETADA" && a.canal === "EN_CONSULTA" && <Button size="xs" variant="ghost" onClick={() => { setEditando(a); setAplicando(escalaDe(a.escala) ?? null); }}>Corregir</Button>}
                {a.estado === "PENDIENTE" && !a.vencida && <Button size="xs" variant="ghost" onClick={() => accion(`${API_SEG}/escalas/aplicaciones/${a.id}/cancelar/`)}>Cancelar</Button>}
                <Button size="icon-xs" variant="ghost" aria-label="Eliminar" onClick={() => confirm("¿Eliminar esta aplicación?") && accion(`${API_SEG}/escalas/aplicaciones/${a.id}/`, "DELETE")}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={Boolean(aplicando)} onOpenChange={(o) => { if (!o) { setAplicando(null); setEditando(null); } }}>
        <DialogContent className="max-w-xl">
          {aplicando && (
            <>
              <DialogHeader>
                <DialogTitle>{aplicando.nombre_largo}</DialogTitle>
                <DialogDescription>{editando ? "Corregir una respuesta actualiza esta misma aplicación." : "Aplicación en consulta. Volver a aplicarla más adelante añade un punto nuevo a la trayectoria."}</DialogDescription>
              </DialogHeader>
              <CuestionarioLikert
                key={`${aplicando.slug}-${editando?.id ?? "nuevo"}`}
                instrucciones={aplicando.instrucciones}
                opciones={aplicando.opciones}
                preguntas={aplicando.preguntas}
                preguntaFuncional={aplicando.pregunta_funcional}
                inicial={editando?.respuestas}
                enviando={enviando}
                textoEnviar="Finalizar y calcular"
                onEnviar={guardarEnConsulta}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resultado)} onOpenChange={(o) => !o && setResultado(null)}>
        <DialogContent className="max-w-xl">
          {resultado && "severidad" in resultado.resultado && (
            <>
              <DialogHeader>
                <DialogTitle>{escalaDe(resultado.escala)?.nombre_largo ?? resultado.nombre}</DialogTitle>
                <DialogDescription>{fechaCorta(resultado.completada_en)} · puntaje registrado en la trayectoria de la ficha.</DialogDescription>
              </DialogHeader>
              <ResultadoVista escala={escalaDe(resultado.escala)} r={resultado.resultado as ResultadoEscala} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(enlace)} onOpenChange={(o) => !o && setEnlace(null)}>
        <DialogContent className="max-w-lg">
          {enlace && (
            <>
              <DialogHeader>
                <DialogTitle>Enlace para el paciente</DialogTitle>
                <DialogDescription>Psiconex no envía nada automáticamente. Copia el enlace o ábrelo en WhatsApp y envíalo tú. Vence el {fechaCorta(enlace.expira_en)}.</DialogDescription>
              </DialogHeader>
              <p className="rounded-lg bg-muted p-3 text-sm">{enlace.mensaje}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { navigator.clipboard.writeText(enlace.mensaje ?? enlace.enlace ?? ""); toast.success("Mensaje copiado"); }}><Copy /> Copiar mensaje</Button>
                {enlace.whatsapp_url ? (
                  <Button variant="outline" onClick={() => window.open(enlace.whatsapp_url, "_blank", "noopener")}><ExternalLink /> Abrir WhatsApp</Button>
                ) : (
                  <p className="text-xs text-muted-foreground">{tieneTelefono ? "El teléfono registrado no parece un celular chileno válido." : "El paciente no tiene celular registrado; agrégalo en sus datos para abrir WhatsApp."}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
