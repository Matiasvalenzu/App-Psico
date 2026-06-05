"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ClipboardList, Eye, Loader2 } from "lucide-react";

interface TestQuestion {
  id: number;
  text: string;
}

interface TestDefinition {
  slug: string;
  name: string;
  short_name: string;
  version: string;
  duration_minutes: number;
  description: string;
  instructions: string;
  response_options: Array<{ value: string; label: string }>;
  questions: TestQuestion[];
  dimensions: Array<{ id: number; name: string; belief: string; questions: number[] }>;
}

export default function TestsCatalogPage() {
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [selected, setSelected] = useState<TestDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTests();
  }, []);

  async function loadTests() {
    try {
      const res = await apiFetch("/evaluaciones/catalogo/");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTests(data);
      setSelected(data[0] || null);
    } catch {
      setError("No se pudo cargar el catálogo de tests.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando catálogo de tests...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de tests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona un instrumento para revisar sus preguntas y la vista que verá el paciente.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {tests.length} test{tests.length !== 1 ? "s" : ""}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {tests.map((test) => (
            <button
              key={test.slug}
              type="button"
              onClick={() => setSelected(test)}
              className={`w-full rounded-xl border p-4 text-left shadow-subtle transition-all hover:-translate-y-0.5 hover:shadow-card ${
                selected?.slug === test.slug
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{test.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {test.questions.length} preguntas · {test.duration_minutes} min aprox.
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-5">
            <section className="rounded-xl border border-border/60 bg-card p-5 shadow-subtle">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                Este test no entrega diagnóstico automático. Sus resultados deben ser revisados por el profesional tratante.
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-card p-5 shadow-subtle">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Vista del paciente
              </p>
              <h3 className="mt-2 text-xl font-bold">{selected.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.instructions}</p>
              <div className="mt-4 grid gap-3">
                {selected.questions.slice(0, 8).map((question) => (
                  <div key={question.id} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="text-sm font-medium">
                      {question.id}. {question.text}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selected.response_options.map((option) => (
                        <div key={option.value} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                          {option.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Vista previa parcial: el paciente verá las {selected.questions.length} preguntas en la página pública del enlace.
              </p>
            </section>

            <section className="rounded-xl border border-border/60 bg-card p-5 shadow-subtle">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dimensiones evaluadas
              </p>
              <div className="mt-4 grid gap-3">
                {selected.dimensions.map((dimension) => (
                  <div key={dimension.id} className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-semibold">
                      {dimension.id}. {dimension.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{dimension.belief}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
