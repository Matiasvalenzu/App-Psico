"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_SEG, LINEAS_AYUDA, colorAnimo, etiquetaAnimo, fechaCorta, type Animo } from "@/lib/seguimiento";

type TareaPublica = { id: number; descripcion: string; fecha_entrega: string | null; completada: boolean; nota_paciente: string; vencida: boolean };
type Datos = { paciente_nombre: string; profesional: string; tareas: TareaPublica[]; animo: Animo[]; emociones_disponibles: string[] };

// Espacio del paciente entre sesiones: registro de ánimo y tareas. No expone datos clínicos.
export default function PortalSeguimientoPage() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState("CARGANDO");
  const [valor, setValor] = useState<number | null>(null);
  const [emociones, setEmociones] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const [guardado, setGuardado] = useState<string>("");
  const [ayuda, setAyuda] = useState(false);
  const [notasTarea, setNotasTarea] = useState<Record<number, string>>({});

  const cargar = useCallback(async () => {
    try {
      const r = await publicApiFetch(`${API_SEG}/portal/${token}/`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setEstado(d.estado ?? "INVALIDO");
      setDatos(d);
      setEstado("OK");
    } catch {
      setEstado("INVALIDO");
    }
  }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardarAnimo() {
    if (!valor) return;
    const r = await publicApiFetch(`${API_SEG}/portal/${token}/animo/`, { method: "POST", body: JSON.stringify({ valor, emociones, nota }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setGuardado(d.detail || "No se pudo guardar.");
    setGuardado("¡Gracias! Guardamos cómo te sientes hoy.");
    setAyuda(Boolean(d.mostrar_ayuda));
    cargar();
  }

  async function completar(id: number) {
    await publicApiFetch(`${API_SEG}/portal/${token}/tareas/${id}/completar/`, { method: "POST", body: JSON.stringify({ nota: notasTarea[id] ?? "" }) });
    cargar();
  }

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-5">
        <Logo className="h-8" />
        {estado === "CARGANDO" && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {(estado === "INVALIDO" || estado === "VENCIDO") && (
          <div className="rounded-2xl border bg-background p-5">
            <h1 className="text-lg font-semibold">{estado === "VENCIDO" ? "Este enlace ya no está disponible" : "Enlace no válido"}</h1>
            <p className="text-sm text-muted-foreground">Pídele a tu profesional un enlace nuevo.</p>
          </div>
        )}
        {estado === "OK" && datos && (
          <>
            <h1 className="text-xl font-semibold">Hola {datos.paciente_nombre}</h1>
            <section className="space-y-3 rounded-2xl border bg-background p-5">
              <h2 className="font-semibold">¿Cómo te sientes hoy?</h2>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                  <button key={v} type="button" aria-pressed={valor === v} onClick={() => setValor(v)}
                    className={`h-12 rounded-xl text-lg font-semibold text-white ${valor === v ? "ring-2 ring-primary ring-offset-2" : "opacity-90"}`} style={{ background: colorAnimo(v) }}>{v}</button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{valor ? `${valor} — ${etiquetaAnimo(valor)}` : "1 = muy bajo · 10 = muy bueno"}</p>
              <div className="flex flex-wrap gap-2">
                {datos.emociones_disponibles.map((e) => (
                  <button key={e} type="button" onClick={() => setEmociones((xs) => (xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e]))}
                    className={`rounded-full border px-3 py-1 text-sm ${emociones.includes(e) ? "border-primary bg-primary/10" : ""}`}>{e}</button>
                ))}
              </div>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Quieres agregar algo? (opcional)" maxLength={500} />
              <Button className="w-full" size="lg" disabled={!valor} onClick={guardarAnimo}>Guardar</Button>
              {guardado && <p className="text-sm">{guardado}</p>}
              {ayuda && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{LINEAS_AYUDA}</p>}
              {datos.animo.length > 0 && (
                <div className="flex gap-1 pt-1" aria-label="Tus últimos registros">
                  {[...datos.animo].reverse().map((a) => (
                    <span key={a.id} title={`${fechaCorta(a.fecha)}: ${a.valor}`} className="flex size-7 items-center justify-center rounded text-xs font-semibold text-white" style={{ background: colorAnimo(a.valor) }}>{a.valor}</span>
                  ))}
                </div>
              )}
            </section>
            <section className="space-y-3 rounded-2xl border bg-background p-5">
              <h2 className="font-semibold">Tus tareas</h2>
              {!datos.tareas.length && <p className="text-sm text-muted-foreground">No tienes tareas por ahora.</p>}
              <ul className="space-y-3">
                {datos.tareas.map((t) => (
                  <li key={t.id} className="rounded-xl border p-3 text-sm">
                    <div className={t.completada ? "line-through opacity-60" : ""}>{t.descripcion}</div>
                    {t.fecha_entrega && <div className={`text-xs ${t.vencida ? "text-red-600" : "text-muted-foreground"}`}>Para el {fechaCorta(t.fecha_entrega)}</div>}
                    {t.completada ? (
                      <div className="mt-1 text-xs text-emerald-700">✓ Completada{t.nota_paciente ? ` · “${t.nota_paciente}”` : ""}</div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <Input value={notasTarea[t.id] ?? ""} onChange={(e) => setNotasTarea((n) => ({ ...n, [t.id]: e.target.value }))} placeholder="¿Cómo te fue? (opcional)" maxLength={1000} />
                        <Button size="sm" onClick={() => completar(t.id)}>Hecha</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <p className="text-center text-xs text-muted-foreground">Este espacio es confidencial entre tú y {datos.profesional}. Si estás en crisis llama al *4141 o acude a urgencias.</p>
          </>
        )}
      </div>
    </main>
  );
}
