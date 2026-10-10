"use client"

import { setMetaConsent, useMetaConsent } from "@/lib/metaConsent"
import { isMetaPixelEnabled, isPixelPath } from "@/lib/metaPixel"
import { usePathname } from "next/navigation"

/**
 * Banner Aceptar / Rechazar para el Meta Pixel. Solo aparece en rutas de la
 * allowlist y mientras el usuario no haya decidido. Nunca en /dashboard.
 */
export function ConsentBanner() {
  const pathname = usePathname()
  const consent = useMetaConsent()

  if (!isMetaPixelEnabled || !isPixelPath(pathname) || consent !== "unset") {
    return null
  }

  const btn =
    "inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div
      role="dialog"
      aria-label="Preferencias de medición publicitaria"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-background/95 p-4 shadow-lg backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Usamos el Meta Pixel para medir nuestra publicidad en estas páginas
          públicas. No enviamos datos clínicos ni de pacientes. Puedes aceptar o
          rechazar, y cambiar tu elección cuando quieras.{" "}
          <a
            href="https://psiconex.cl/privacidad#meta-pixel"
            className="text-primary underline underline-offset-4"
          >
            Más información
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={`${btn} bg-background text-foreground hover:bg-muted`}
            onClick={() => setMetaConsent("rejected")}
          >
            Rechazar
          </button>
          <button
            type="button"
            className={`${btn} border-transparent bg-primary text-primary-foreground hover:bg-primary/90`}
            onClick={() => setMetaConsent("accepted")}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
