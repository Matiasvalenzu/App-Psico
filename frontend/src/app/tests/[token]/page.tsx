"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";

interface TestQuestion {
  id: number;
  text: string;
}

interface PublicTestPayload {
  estado: string;
  message?: string;
  paciente_nombre?: string;
  fecha_expiracion?: string;
  test?: {
    slug: string;
    name: string;
    description: string;
    instructions: string;
    response_options: Array<{ value: string; label: string }>;
    questions: TestQuestion[];
  };
}

export default function PublicTestPage() {
  const params = useParams();
  const token = params.token as string;
  const [payload, setPayload] = useState<PublicTestPayload | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [completedMessage, setCompletedMessage] = useState("");

  useEffect(() => {
    loadTest();
  }, [token]);

  const answeredCount = useMemo(
    () => Object.keys(responses).filter((key) => responses[key]).length,
    [responses]
  );
  const totalQuestions = payload?.test?.questions.length || 0;
  const isComplete = totalQuestions > 0 && answeredCount === totalQuestions;

  async function loadTest() {
    try {
      const res = await publicApiFetch(`/evaluaciones/publicas/${token}/`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "No se pudo cargar el test.");
        return;
      }
      if (data.estado === "COMPLETADO") {
        setCompleted(true);
        setCompletedMessage(data.message || "Este test ya fue completado.");
        return;
      }
      setPayload(data);
    } catch {
      setError("No se pudo cargar el test. Intenta nuevamente más tarde.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await publicApiFetch(`/evaluaciones/publicas/${token}/responder/`, {
        method: "POST",
        body: JSON.stringify({ respuestas: responses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "No se pudieron guardar tus respuestas.");
        return;
      }
      setCompleted(true);
      setCompletedMessage(data.message || "Gracias. Tus respuestas fueron guardadas.");
    } catch {
      setError("No se pudieron guardar tus respuestas. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/40 px-4 py-8">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-border/60 bg-card p-5 text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando test...
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="min-h-screen bg-muted/40 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-card p-8 text-center shadow-card dark:border-emerald-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Test completado</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {completedMessage || "Gracias. Tus respuestas fueron guardadas y serán revisadas por tu psicólogo/a."}
          </p>
          <p className="mt-5 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
            Ya puedes cerrar esta ventana. No necesitas realizar ninguna acción adicional.
          </p>
        </div>
      </main>
    );
  }

  if (error && !payload?.test) {
    return (
      <main className="min-h-screen bg-muted/40 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-card">
          <h1 className="text-2xl font-bold">No se puede abrir el test</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  const test = payload?.test;
  if (!test) return null;

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8">
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Hola{payload?.paciente_nombre ? `, ${payload.paciente_nombre}` : ""}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{test.name}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{test.description}</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {test.instructions}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Este instrumento no reemplaza una evaluación profesional. Tus respuestas serán revisadas por tu psicólogo/a.
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Progreso: {answeredCount} de {totalQuestions} preguntas respondidas
          </div>
        </section>

        <section className="grid gap-3">
          {test.questions.map((question) => (
            <div key={question.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-subtle">
              <p className="text-sm font-medium leading-relaxed">
                {question.id}. {question.text}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {test.response_options.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      responses[String(question.id)] === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option.value}
                      checked={responses[String(question.id)] === option.value}
                      onChange={() =>
                        setResponses((prev) => ({ ...prev, [String(question.id)]: option.value }))
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="sticky bottom-4 rounded-xl border border-border/60 bg-card/95 p-4 shadow-elevated backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isComplete ? "Todas las preguntas están respondidas." : `Faltan ${totalQuestions - answeredCount} preguntas.`}
            </p>
            <button
              type="submit"
              disabled={!isComplete || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando..." : "Enviar respuestas"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
