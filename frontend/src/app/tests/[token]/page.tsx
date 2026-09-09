"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Flame,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";

interface TestQuestion {
  id: number;
  dimension_id?: number;
  name?: string;
  phrase?: string;
  text: string;
  belief?: string;
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
    scale_info?: {
      min: number;
      max: number;
      labels: {
        actual: string;
        deseado: string;
      };
    };
  };
}

export default function PublicTestPage() {
  const params = useParams();
  const token = params.token as string;
  const [payload, setPayload] = useState<PublicTestPayload | null>(null);

  // Standard radio responses (for Ellis)
  const [responses, setResponses] = useState<Record<string, string>>({});

  // Rueda dual responses: { [questionId]: { actual: number, deseado: number } }
  const [ruedaResponses, setRuedaResponses] = useState<
    Record<string, { actual?: number; deseado?: number }>
  >({});
  const [ruedaStep, setRuedaStep] = useState(0);
  const [ruedaViewAll, setRuedaViewAll] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [completedMessage, setCompletedMessage] = useState("");
  const [completionMeta, setCompletionMeta] = useState<{
    paciente_id?: number;
    sesion_id?: number;
  } | null>(null);

  useEffect(() => {
    loadTest();
  }, [token]);

  const isRueda = payload?.test?.slug === "rueda-creencias";
  const totalQuestions = payload?.test?.questions.length || 0;

  const answeredCount = useMemo(() => {
    if (isRueda) {
      return Object.keys(ruedaResponses).filter(
        (key) =>
          ruedaResponses[key]?.actual !== undefined &&
          ruedaResponses[key]?.deseado !== undefined
      ).length;
    }
    return Object.keys(responses).filter((key) => responses[key]).length;
  }, [isRueda, ruedaResponses, responses]);

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

  function handleRuedaSelect(questionId: number, field: "actual" | "deseado", value: number) {
    setRuedaResponses((prev) => {
      const current = prev[String(questionId)] || {};
      return {
        ...prev,
        [String(questionId)]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setError("");

    const finalBody = isRueda ? { respuestas: ruedaResponses } : { respuestas: responses };

    try {
      const res = await publicApiFetch(`/evaluaciones/publicas/${token}/responder/`, {
        method: "POST",
        body: JSON.stringify(finalBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "No se pudieron guardar tus respuestas.");
        return;
      }
      setCompleted(true);
      setCompletedMessage(data.message || "Gracias. Tus respuestas fueron guardadas.");
      if (data.paciente_id || data.sesion_id) {
        setCompletionMeta({
          paciente_id: data.paciente_id,
          sesion_id: data.sesion_id,
        });
      }
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
          Cargando instrumento...
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="min-h-screen bg-muted/40 px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-card p-8 text-center shadow-card dark:border-emerald-900/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Evaluación completada</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {completedMessage ||
              "Gracias. Tus respuestas fueron registradas exitosamente y serán revisadas por tu profesional tratante en tu próxima sesión."}
          </p>

          {completionMeta?.paciente_id && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-border/60 pt-6">
              {completionMeta.sesion_id ? (
                <a
                  href={`/dashboard/pacientes/${completionMeta.paciente_id}/sesiones/${completionMeta.sesion_id}`}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  <span>Ver resultados clínicos en la sesión</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <a
                href={`/dashboard/pacientes/${completionMeta.paciente_id}`}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-accent"
              >
                Volver a ficha del paciente
              </a>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
            {completionMeta?.paciente_id
              ? "Evaluación registrada y sincronizada con la ficha clínica del paciente."
              : "Ya puedes cerrar esta pestaña. Toda la información ha sido transmitida de manera segura y confidencial."}
          </div>
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

  const currentQ = test.questions[ruedaStep];
  const currentQResponses = currentQ ? ruedaResponses[String(currentQ.id)] : null;
  const isCurrentStepComplete =
    currentQResponses?.actual !== undefined && currentQResponses?.deseado !== undefined;

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        {/* Header banner */}
        <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {isRueda ? <Sparkles className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Hola{payload?.paciente_nombre ? `, ${payload.paciente_nombre}` : ""}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{test.name}</h1>
              <p className="mt-1 text-xs text-muted-foreground">{test.description}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {test.instructions}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs">
            <span className="font-medium text-muted-foreground">
              Progreso: {answeredCount} de {totalQuestions} creencias completadas
            </span>
            {isRueda && (
              <button
                type="button"
                onClick={() => setRuedaViewAll(!ruedaViewAll)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
              >
                {ruedaViewAll ? (
                  <>
                    <ListOrdered className="h-3.5 w-3.5" />
                    Modo paso a paso
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Ver todas las creencias
                  </>
                )}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(answeredCount / Math.max(1, totalQuestions)) * 100}%` }}
            />
          </div>
        </section>

        {/* RUEDA DE CREENCIAS: Modo Paso a Paso */}
        {isRueda && !ruedaViewAll && currentQ && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card space-y-6 transition-all duration-200">
              {/* Step indicator header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  Creencia {ruedaStep + 1} de {totalQuestions}
                </span>
                <div className="flex gap-1">
                  {test.questions.map((q, idx) => {
                    const isAnswered =
                      ruedaResponses[String(q.id)]?.actual !== undefined &&
                      ruedaResponses[String(q.id)]?.deseado !== undefined;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setRuedaStep(idx)}
                        className={`h-2.5 rounded-full transition-all cursor-pointer ${
                          idx === ruedaStep
                            ? "w-6 bg-primary"
                            : isAnswered
                            ? "w-2.5 bg-emerald-500"
                            : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                        }`}
                        title={`${idx + 1}. ${q.name || q.text}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Belief info */}
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {currentQ.name || `Creencia ${currentQ.id}`}
                </h2>
                {currentQ.phrase && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium italic text-foreground leading-relaxed">
                      &ldquo;{currentQ.phrase}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Question 1: Presencia Actual (1-10) */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-500" />
                  <label className="text-sm font-semibold text-foreground">
                    1. ¿Qué tan presente o influyente está esta creencia en tu vida hoy?
                  </label>
                </div>
                <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span>1 = Nada presente</span>
                  <span>10 = Totalmente presente</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                    const isSelected = currentQResponses?.actual === val;
                    return (
                      <button
                        key={`act-${val}`}
                        type="button"
                        onClick={() => handleRuedaSelect(currentQ.id, "actual", val)}
                        className={`flex h-11 items-center justify-center rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "border-rose-500 bg-rose-500 text-white shadow-sm scale-105"
                            : "border-border bg-card text-foreground hover:border-rose-300 hover:bg-rose-50/50 dark:hover:bg-rose-950/30"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question 2: Meta terapéutica / deseada (1-10) */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-sky-500" />
                  <label className="text-sm font-semibold text-foreground">
                    2. ¿A qué nivel te gustaría reducirla o transformarla como meta personal?
                  </label>
                </div>
                <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span>1 = Deseo reducirla al mínimo</span>
                  <span>10 = Deseo mantenerla igual</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                    const isSelected = currentQResponses?.deseado === val;
                    return (
                      <button
                        key={`des-${val}`}
                        type="button"
                        onClick={() => handleRuedaSelect(currentQ.id, "deseado", val)}
                        className={`flex h-11 items-center justify-center rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "border-sky-500 bg-sky-500 text-white shadow-sm scale-105"
                            : "border-border bg-card text-foreground hover:border-sky-300 hover:bg-sky-50/50 dark:hover:bg-sky-950/30"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between border-t border-border/60 pt-4">
                <button
                  type="button"
                  disabled={ruedaStep === 0}
                  onClick={() => setRuedaStep((prev) => Math.max(0, prev - 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>

                {ruedaStep < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => setRuedaStep((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 cursor-pointer"
                  >
                    Siguiente
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">
                    Última creencia del cuestionario
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* RUEDA DE CREENCIAS: Modo Ver Todas */}
        {isRueda && ruedaViewAll && (
          <section className="space-y-4">
            {test.questions.map((q, idx) => {
              const qResp = ruedaResponses[String(q.id)];
              return (
                <div key={q.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-primary">Creencia {idx + 1} de {totalQuestions}</span>
                      <h3 className="text-base font-bold text-foreground mt-0.5">{q.name || q.text}</h3>
                    </div>
                  </div>

                  {q.phrase && (
                    <p className="text-xs italic text-muted-foreground bg-muted/40 p-3 rounded-lg">
                      &ldquo;{q.phrase}&rdquo;
                    </p>
                  )}

                  {/* Escala 1: Actual */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1 text-foreground">
                        <Flame className="h-3.5 w-3.5 text-rose-500" /> Presencia actual:
                      </span>
                      <span className="text-muted-foreground text-[11px]">(1 = Mínima, 10 = Máxima)</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                        <button
                          key={`act-all-${q.id}-${v}`}
                          type="button"
                          onClick={() => handleRuedaSelect(q.id, "actual", v)}
                          className={`h-9 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            qResp?.actual === v
                              ? "border-rose-500 bg-rose-500 text-white shadow-xs"
                              : "border-border bg-background hover:bg-rose-50/40"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Escala 2: Deseado */}
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1 text-foreground">
                        <Target className="h-3.5 w-3.5 text-sky-500" /> Meta terapéutica:
                      </span>
                      <span className="text-muted-foreground text-[11px]">(1 = Reducir al mín, 10 = Mantener)</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                        <button
                          key={`des-all-${q.id}-${v}`}
                          type="button"
                          onClick={() => handleRuedaSelect(q.id, "deseado", v)}
                          className={`h-9 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            qResp?.deseado === v
                              ? "border-sky-500 bg-sky-500 text-white shadow-xs"
                              : "border-border bg-background hover:bg-sky-50/40"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* TEST CONVENCIONAL: CREENCIAS ELLIS (100 preguntas) */}
        {!isRueda && (
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
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Sticky Submit Footer */}
        <div className="sticky bottom-4 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-elevated backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {isComplete
                  ? "Todas las creencias han sido evaluadas."
                  : `Faltan ${totalQuestions - answeredCount} creencias por evaluar.`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isComplete
                  ? "Ya puedes enviar tus respuestas a tu psicólogo/a."
                  : "Por favor, completa ambas preguntas para cada una de las 10 creencias."}
              </p>
            </div>
            <button
              type="submit"
              disabled={!isComplete || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Enviando..." : "Enviar respuestas"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
