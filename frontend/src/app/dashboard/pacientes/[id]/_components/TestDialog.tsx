"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Play, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage, type CatalogTestItem, type Paciente, type TestSendResult } from "./utils";

export type TestMode = "start" | "send";

const DEFAULT_TESTS: CatalogTestItem[] = [
  {
    slug: "rueda-vida",
    name: "Rueda de la Vida",
    short_name: "Rueda de la Vida",
    duration_minutes: 2,
    description: "10 áreas vitales (Salud, Dinero, Trabajo, Amor...) evaluadas del 1 al 10 con gráfico de radar.",
    tipo_evaluacion: "rueda_polar",
  },
  {
    slug: "creencias-ellis",
    name: "Test de Creencias Ellis",
    short_name: "Ellis 100",
    duration_minutes: 20,
    description: "100 preguntas dicotómicas (De acuerdo / No de acuerdo).",
  },
];

// Comenzar un test en sesión o enviarlo por correo al paciente.
export default function TestDialog({
  open,
  initialMode,
  paciente,
  onOpenChange,
}: {
  open: boolean;
  initialMode: TestMode;
  paciente: Paciente;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<TestMode>(initialMode);
  const [catalogTests, setCatalogTests] = useState<CatalogTestItem[]>(DEFAULT_TESTS);
  const [selectedTestSlug, setSelectedTestSlug] = useState("rueda-vida");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TestSendResult | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function loadTestCatalog() {
      try {
        const res = await apiFetch("/evaluaciones/catalogo/");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) setCatalogTests(data);
        }
      } catch {
        // se mantienen los tests por defecto
      }
    }
    loadTestCatalog();
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError("");
    setResult(null);
    setCopySuccess(false);
  }, [open, initialMode]);

  async function handleExecute() {
    setError("");
    setResult(null);
    setCopySuccess(false);
    if (mode === "send" && !paciente.email_contacto) {
      setError("El paciente no tiene correo registrado. Edita la ficha antes de enviar el test.");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch("/evaluaciones/asignaciones/", {
        method: "POST",
        body: JSON.stringify({
          paciente: paciente.id,
          test_slug: selectedTestSlug,
          enviar_email: mode === "send",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(getApiErrorMessage(data, "No se pudo generar el test."));
        return;
      }
      setResult(data);
      if (mode === "start" && data.public_url) window.open(data.public_url, "_blank");
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el test.");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!result?.public_url) return;
    try {
      await navigator.clipboard.writeText(result.public_url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      setError("No se pudo copiar el enlace automáticamente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "start" ? (
              <Play className="h-5 w-5 text-primary" />
            ) : (
              <Send className="h-5 w-5 text-primary" />
            )}
            {mode === "start" ? "Comenzar test en sesión" : "Enviar test al paciente"}
          </DialogTitle>
          <DialogDescription>
            {mode === "start"
              ? `Aplica el test en tiempo real junto a ${paciente.nombre_completo}. Al completarlo, los gráficos y análisis se guardan en su ficha.`
              : `Se generará un enlace personal para ${paciente.nombre_completo} con vencimiento de 7 días y uso único.`}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Modo de aplicación" className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/60 p-1">
          {(["start", "send"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "start" ? <Play className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {m === "start" ? "En sesión" : "Por correo"}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Instrumento
          </legend>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {catalogTests.map((t) => {
              const isSelected = selectedTestSlug === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTestSlug(t.slug)}
                  className={cn(
                    "rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "border-border/70 bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t.duration_minutes ? `${t.duration_minutes} min` : "Estándar"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                </button>
              );
            })}
          </div>
        </fieldset>

        {mode === "start" ? (
          <p className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Se abrirá el instrumento en una nueva pestaña. Puedes proyectarlo en el box o compartir solo esa
            pestaña en Google Meet / Zoom sin exponer tus notas clínicas.
          </p>
        ) : (
          <>
            <dl className="space-y-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
              <div>
                <dt className="font-medium">Correo destino</dt>
                <dd className="mt-0.5 text-muted-foreground">{paciente.email_contacto || "Sin correo registrado"}</dd>
              </div>
              <div>
                <dt className="font-medium">Mensaje estándar</dt>
                <dd className="mt-0.5 text-muted-foreground">
                  Hola {paciente.nombre}, tu psicólogo/a te solicita completar el{" "}
                  {catalogTests.find((t) => t.slug === selectedTestSlug)?.name || "test"} como parte de tu proceso. El
                  enlace es personal, vence en 7 días y no requiere iniciar sesión.
                </dd>
              </div>
            </dl>
            {!paciente.email_contacto && (
              <Alert variant="warning">
                <AlertDescription>
                  Para enviar el test por correo registra un correo de contacto en la ficha del paciente.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {result && (
          <Alert variant="success">
            <AlertTitle>
              {mode === "start"
                ? "Evaluación lista para comenzar."
                : result.email_enviado
                ? "Correo enviado correctamente."
                : "Enlace generado. El correo queda pendiente hasta configurar SMTP."}
            </AlertTitle>
            <AlertDescription>
              {result.email_error && mode === "send" && <p>{result.email_error}</p>}
              {mode === "start" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => window.open(result.public_url, "_blank")}>
                    <ExternalLink />
                    Abrir en nueva pestaña
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => router.push(result.public_url)}>
                    Abrir aquí
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    <Copy />
                    {copySuccess ? "Copiado" : "Copiar enlace"}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input readOnly aria-label="Enlace del test" value={result.public_url} className="min-w-0 flex-1" />
                  <Button variant="outline" onClick={copyLink}>
                    <Copy />
                    {copySuccess ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleExecute} disabled={sending || (mode === "send" && !paciente.email_contacto)}>
            {sending && <Loader2 className="animate-spin" />}
            {sending ? "Generando..." : mode === "start" ? "Comenzar test ahora" : "Generar y enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
