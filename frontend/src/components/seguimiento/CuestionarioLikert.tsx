"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Opcion, Pregunta } from "@/lib/seguimiento";

type Props = {
  instrucciones: string;
  opciones: Opcion[];
  preguntas: Pregunta[];
  preguntaFuncional?: { id: number; texto: string; opciones: Opcion[] } | null;
  inicial?: Record<string, number>;
  enviando?: boolean;
  textoEnviar?: string;
  onEnviar: (respuestas: Record<string, number>) => void;
};

// Cuestionario de una pregunta por pantalla con auto-avance; sirve en consulta y en el enlace del paciente.
export default function CuestionarioLikert({ instrucciones, opciones, preguntas, preguntaFuncional, inicial, enviando, textoEnviar = "Enviar respuestas", onEnviar }: Props) {
  const items = useMemo(
    () => [...preguntas.map((p) => ({ ...p, opciones })), ...(preguntaFuncional ? [{ ...preguntaFuncional, opcional: true }] : [])],
    [preguntas, opciones, preguntaFuncional],
  );
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>(inicial ?? {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const revisando = paso >= items.length;
  const item = items[Math.min(paso, items.length - 1)];
  const obligatorias = preguntas.length;
  const respondidas = preguntas.filter((p) => respuestas[String(p.id)] !== undefined).length;
  const completo = respondidas === obligatorias;

  function elegir(valor: number) {
    setRespuestas((r) => ({ ...r, [String(item.id)]: valor }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPaso((p) => Math.min(p + 1, items.length)), 250);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{revisando ? "Revisa tus respuestas" : `Pregunta ${paso + 1} de ${items.length}`}</span>
          <span>{respondidas} de {obligatorias} respondidas</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-primary transition-all" style={{ width: `${(respondidas / obligatorias) * 100}%` }} />
        </div>
      </div>

      {!revisando ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{"opcional" in item && item.opcional ? "Pregunta final (opcional)" : instrucciones}</p>
          <p className="text-lg font-semibold leading-snug">{item.texto}</p>
          <div role="radiogroup" aria-label={item.texto} className="grid gap-2">
            {item.opciones.map((o) => {
              const activo = respuestas[String(item.id)] === o.valor;
              return (
                <button
                  key={o.valor}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegir(o.valor)}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activo ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted"}`}
                >
                  {o.texto}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
              <ChevronLeft /> Anterior
            </Button>
            <Button type="button" variant="ghost" disabled={respuestas[String(item.id)] === undefined && !("opcional" in item && item.opcional)} onClick={() => setPaso((p) => p + 1)}>
              Siguiente <ChevronRight />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ol className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {items.map((it, i) => {
              const v = respuestas[String(it.id)];
              const texto = it.opciones.find((o) => o.valor === v)?.texto;
              return (
                <li key={it.id}>
                  <button type="button" className="w-full rounded-md px-2 py-1 text-left hover:bg-muted" onClick={() => setPaso(i)}>
                    <span className="text-muted-foreground">{i + 1}.</span> {it.texto} —{" "}
                    <strong className={texto ? "" : "text-destructive"}>{texto ?? ("opcional" in it && it.opcional ? "sin responder (opcional)" : "falta responder")}</strong>
                  </button>
                </li>
              );
            })}
          </ol>
          <Button type="button" className="w-full" size="lg" disabled={!completo || enviando} onClick={() => onEnviar(respuestas)}>
            {enviando ? "Enviando…" : textoEnviar}
          </Button>
        </div>
      )}
    </div>
  );
}
