"use client"

import { setMetaConsent, useMetaConsent } from "@/lib/metaConsent"
import { isMetaPixelEnabled } from "@/lib/metaPixel"

/**
 * Permite ver y cambiar la elección sobre el Meta Pixel desde /privacidad.
 * Al rechazar se recarga la página para descargar el script si ya estaba activo.
 */
export function ConsentPreferences() {
  const consent = useMetaConsent()

  if (!isMetaPixelEnabled) {
    return (
      <p className="mt-3 text-sm">
        Actualmente la medición publicitaria con Meta Pixel está desactivada.
      </p>
    )
  }
  if (consent === "pending") return null

  const label =
    consent === "accepted"
      ? "Aceptada"
      : consent === "rejected"
        ? "Rechazada"
        : "Aún no has elegido"

  const choose = (value: "accepted" | "rejected") => {
    const wasLoaded = typeof window.fbq === "function"
    setMetaConsent(value)
    if (value === "rejected" && wasLoaded) window.location.reload()
  }

  const btn =
    "inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <p className="text-sm">
        Tu elección actual: <strong className="text-foreground">{label}</strong>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className={btn} onClick={() => choose("accepted")}>
          Aceptar
        </button>
        <button type="button" className={btn} onClick={() => choose("rejected")}>
          Rechazar
        </button>
      </div>
    </div>
  )
}
