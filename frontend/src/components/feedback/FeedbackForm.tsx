"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bug,
  Lightbulb,
  Heart,
  HelpCircle,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  FeedbackTipo,
  FeedbackModulo,
  FeedbackSeveridad,
  FeedbackReport,
} from "@/types/feedback";

interface FeedbackFormProps {
  onSuccess?: (report: FeedbackReport) => void;
  compact?: boolean;
  initialModulo?: FeedbackModulo;
}

const TIPOS_FEEDBACK = [
  {
    id: "error" as FeedbackTipo,
    label: "Reportar un Error",
    subtitle: "Falla técnica o comportamiento inesperado",
    icon: Bug,
    colorClass: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    activeClass: "ring-2 ring-rose-500 bg-rose-500/15 border-rose-500/40",
  },
  {
    id: "mejora" as FeedbackTipo,
    label: "Sugerencia de Mejora",
    subtitle: "Ideas para nuevas funciones o optimizaciones",
    icon: Lightbulb,
    colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    activeClass: "ring-2 ring-amber-500 bg-amber-500/15 border-amber-500/40",
  },
  {
    id: "felicitacion" as FeedbackTipo,
    label: "Felicitación / Experiencia",
    subtitle: "Cuéntanos qué es lo que más valoras de Psiconex",
    icon: Heart,
    colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    activeClass: "ring-2 ring-emerald-500 bg-emerald-500/15 border-emerald-500/40",
  },
  {
    id: "consulta" as FeedbackTipo,
    label: "Consulta o Duda",
    subtitle: "Preguntas sobre uso o configuración",
    icon: HelpCircle,
    colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    activeClass: "ring-2 ring-blue-500 bg-blue-500/15 border-blue-500/40",
  },
];

const MODULOS: { id: FeedbackModulo; label: string }[] = [
  { id: "general", label: "General / Interfaz visual" },
  { id: "pacientes", label: "Pacientes / Ficha Clínica" },
  { id: "sesiones", label: "Sesiones y Transcripción de Audio" },
  { id: "agenda", label: "Agenda y Citas" },
  { id: "tests", label: "Tests Psicológicos" },
  { id: "facturacion", label: "Facturación / Boletas SII" },
  { id: "suscripcion", label: "Mi Suscripción y Pagos" },
  { id: "perfil", label: "Mi Perfil / Configuración" },
];

const SEVERIDADES: { id: FeedbackSeveridad; label: string; desc: string }[] = [
  { id: "baja", label: "Baja", desc: "Detalle estético o menor sin impacto funcional" },
  { id: "media", label: "Media", desc: "Dificulta una tarea pero puedo continuar" },
  { id: "alta", label: "Alta", desc: "Afecta una función crítica de mi consulta" },
  { id: "critica", label: "Crítica", desc: "Bloqueante: no puedo atender o guardar datos" },
];

const IMPACTOS_MEJORA = [
  "Deseable — Sería una comodidad adicional",
  "Muy útil — Me ahorraría bastante tiempo semanal",
  "Imprescindible — Es esencial para mi flujo de trabajo",
];

export default function FeedbackForm({
  onSuccess,
  compact = false,
  initialModulo = "general",
}: FeedbackFormProps) {
  const [tipo, setTipo] = useState<FeedbackTipo>("mejora");
  const [modulo, setModulo] = useState<FeedbackModulo>(initialModulo);
  const [severidad, setSeveridad] = useState<FeedbackSeveridad>("media");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pasosReproducir, setPasosReproducir] = useState("");
  const [impactoMejora, setImpactoMejora] = useState(IMPACTOS_MEJORA[1]);
  
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enviadoExitoso, setEnviadoExitoso] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Interceptar Ctrl+V para pegar capturas de pantalla directamente
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith("image/")) {
          setArchivo(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivo(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setArchivo(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const removerArchivo = () => {
    setArchivo(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!titulo.trim()) {
      setErrorMessage("Por favor ingresa un título o asunto para tu reporte.");
      return;
    }
    if (!descripcion.trim()) {
      setErrorMessage("Por favor describe con más detalle tu feedback o el error.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("tipo", tipo);
      formData.append("modulo", modulo);
      formData.append("severidad", tipo === "error" ? severidad : "media");
      formData.append("titulo", titulo.trim());
      formData.append("descripcion", descripcion.trim());
      
      if (tipo === "error" && pasosReproducir.trim()) {
        formData.append("pasos_reproducir", pasosReproducir.trim());
      }
      if (tipo === "mejora" && impactoMejora) {
        formData.append("impacto_mejora", impactoMejora);
      }
      if (archivo) {
        formData.append("archivo_adjunto", archivo);
      }

      // Metadata contextual
      if (typeof window !== "undefined") {
        formData.append("url_origen", window.location.href);
        formData.append("user_agent", window.navigator.userAgent);
        formData.append(
          "resolucion_pantalla",
          `${window.screen.width}x${window.screen.height}`
        );
      }

      const res = await apiFetch("/feedback/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            errorData.archivo_adjunto?.[0] ||
            "Ocurrió un error al enviar el feedback. Por favor intenta de nuevo."
        );
      }

      const data: FeedbackReport = await res.json();
      setEnviadoExitoso(true);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const resetFormulario = () => {
    setTitulo("");
    setDescripcion("");
    setPasosReproducir("");
    removerArchivo();
    setEnviadoExitoso(false);
    setErrorMessage(null);
  };

  if (enviadoExitoso) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-card border border-border shadow-sm animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 mb-4 ring-8 ring-emerald-500/5">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h3 className="text-xl font-bold text-foreground">
          ¡Muchas gracias por tu feedback!
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Hemos recibido tu reporte correctamente. Nuestro equipo lo revisará a
          la brevedad. También te hemos enviado un correo de confirmación.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={resetFormulario}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
          >
            Enviar otro reporte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selector de Tipo de Feedback */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ¿Qué tipo de feedback deseas compartir?
          </label>
          <div
            className={`grid gap-3 ${
              compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {TIPOS_FEEDBACK.map((item) => {
              const Icon = item.icon;
              const isSelected = tipo === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTipo(item.id)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? `${item.activeClass} shadow-sm`
                      : "border-border/70 bg-card hover:bg-accent/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">
                      {item.label}
                    </span>
                  </div>
                  {!compact && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {item.subtitle}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fila Módulo + Severidad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Módulo o Sección <span className="text-destructive">*</span>
            </label>
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value as FeedbackModulo)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {MODULOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {tipo === "error" ? (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-xs font-semibold text-foreground">
                Severidad / Urgencia <span className="text-destructive">*</span>
              </label>
              <select
                value={severidad}
                onChange={(e) => setSeveridad(e.target.value as FeedbackSeveridad)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {SEVERIDADES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.desc})
                  </option>
                ))}
              </select>
            </div>
          ) : tipo === "mejora" ? (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-xs font-semibold text-foreground">
                Impacto esperado en tu práctica
              </label>
              <select
                value={impactoMejora}
                onChange={(e) => setImpactoMejora(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {IMPACTOS_MEJORA.map((imp, idx) => (
                  <option key={idx} value={imp}>
                    {imp}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {/* Título o Asunto */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {tipo === "error"
              ? "Resumen del error"
              : tipo === "mejora"
              ? "¿Qué función o mejora te gustaría tener?"
              : "Asunto / Título"}{" "}
            <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={
              tipo === "error"
                ? "Ej: El botón de exportar ficha queda cargando indefinidamente"
                : tipo === "mejora"
                ? "Ej: Posibilidad de agregar notas rápidas en el calendario"
                : "Ej: Excelente experiencia con la transcripción"
            }
            className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Descripción detallada */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Descripción detallada <span className="text-destructive">*</span>
          </label>
          <textarea
            required
            rows={compact ? 3 : 4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={
              tipo === "error"
                ? "Cuéntanos con el mayor detalle posible qué estabas intentando hacer y qué error o mensaje observaste en la pantalla..."
                : tipo === "mejora"
                ? "Explícanos cómo funcionaría esta idea y de qué forma optimizaría tu tiempo o la atención de tus pacientes..."
                : "Escribe aquí tu mensaje o comentario..."
            }
            className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60 resize-y"
          />
        </div>

        {/* Pasos para reproducir (Solo si es error) */}
        {tipo === "error" && (
          <div className="space-y-1.5 animate-in fade-in">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Pasos para reproducir (Opcional pero muy útil)</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                1. Fui a..., 2. Hice clic en...
              </span>
            </label>
            <textarea
              rows={2}
              value={pasosReproducir}
              onChange={(e) => setPasosReproducir(e.target.value)}
              placeholder="Ejemplo:&#10;1. Entré a la ficha del paciente Juan Pérez&#10;2. Presioné 'Generar Informe Clínico'&#10;3. Apareció pantalla roja de error"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60 resize-y"
            />
          </div>
        )}

        {/* Zona de Archivos / Captura de pantalla */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Captura de pantalla o archivo adjunto (Opcional)
            </label>
            <span className="text-[11px] text-muted-foreground">
              Tip: Puedes presionar <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Ctrl+V</kbd> para pegar una captura
            </span>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,.txt,.log"
            className="hidden"
          />

          {!archivo ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[0.99]"
                  : "border-border/80 hover:border-primary/50 hover:bg-accent/30 bg-card/50"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground text-center">
                Haz clic para subir o arrastra una captura aquí
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PNG, JPG, WebP o PDF hasta 10 MB
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 overflow-hidden">
                {previewUrl ? (
                  <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-border bg-muted">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {archivo.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(archivo.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removerArchivo}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                title="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Botón de Envío */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Enviando reporte...</span>
              </>
            ) : (
              <span>Enviar reporte a Psiconex</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
