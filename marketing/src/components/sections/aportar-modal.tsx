"use client"

import { useState, useEffect } from "react"
import { X, Send, CheckCircle2, HeartHandshake, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientPortal } from "@/components/ui/ClientPortal"
import { APP_URL } from "@/lib/config"

interface AportarModalProps {
  isOpen: boolean
  onClose: () => void
}

const ESPECIALIDADES = [
  "Psicología clínica",
  "Psicoterapia",
  "Psiquiatría",
  "Neuropsicología",
  "Otra",
]

export function AportarModal({ isOpen, onClose }: AportarModalProps) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [especialidad, setEspecialidad] = useState("Psicología clínica")
  const [comentario, setComentario] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Limpiar estado al cerrar
  useEffect(() => {
    if (!isOpen) {
      setStatus("idle")
      setErrorMessage("")
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Por favor ingresa un correo electrónico válido.")
      return
    }
    if (!comentario.trim()) {
      setErrorMessage("Por favor escribe tu comentario o aporte.")
      return
    }

    setStatus("submitting")
    setErrorMessage("")

    const payload = {
      nombre: nombre.trim(),
      email: email.trim(),
      especialidad,
      comentario: comentario.trim(),
    }

    try {
      // 1. Intentar primero con la ruta interna Next.js
      let res = await fetch("/api/aportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null)

      // 2. Si no respondió o falló, fallback directo al backend Django
      if (!res || !res.ok) {
        const directUrl = `${APP_URL}/api/feedback/aportar/`
        res = await fetch(directUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (res && res.ok) {
        setStatus("success")
        setNombre("")
        setEmail("")
        setComentario("")
      } else {
        const errorData = await res?.json().catch(() => ({}))
        setErrorMessage(
          errorData?.error ||
            "No pudimos enviar tu mensaje en este momento. Por favor escríbenos directamente a matias@datnexia.com."
        )
        setStatus("error")
      }
    } catch {
      setErrorMessage(
        "Hubo un error de conexión al enviar el formulario. Puedes escribirnos directamente a matias@datnexia.com."
      )
      setStatus("error")
    }
  }

  return (
    <ClientPortal>
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-aportar-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Cerrar ventana"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3
              id="modal-aportar-title"
              className="mt-4 text-xl font-semibold tracking-tight text-foreground"
            >
              ¡Muchas gracias por tu aporte!
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Hemos recibido tu mensaje y se envió como correo a{" "}
              <strong className="text-foreground">matias@datnexia.com</strong>.
              Valoramos enormemente que compartas tu visión y tiempo con nosotros.
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={onClose} size="lg" className="w-full sm:w-auto">
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="modal-aportar-title"
                  className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
                >
                  Quiero aportar a Psiconex
                </h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Construimos la plataforma escuchando a la consulta clínica.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Tu nombre o cómo prefieres que te llamemos
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Dra. Camila Soto, Matías..."
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Correo electrónico <span className="text-primary">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.cl"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Te responderemos directamente a este correo.
                </p>
              </div>

              {/* Especialidad */}
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Especialidad / Área
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ESPECIALIDADES.map((esp) => (
                    <button
                      key={esp}
                      type="button"
                      onClick={() => setEspecialidad(esp)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        especialidad === esp
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {esp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentario */}
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Tu comentario, feedback o experiencia <span className="text-primary">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Cuéntanos cómo trabajas, qué te gustaría ver en la herramienta o qué podemos mejorar..."
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  {errorMessage}
                </div>
              )}

              {/* Botones de acción */}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={status === "submitting"}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={status === "submitting"}
                  className="gap-2"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar aporte
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ClientPortal>
  )
}
