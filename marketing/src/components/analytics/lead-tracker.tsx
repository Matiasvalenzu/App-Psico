"use client"

import { useEffect } from "react"

import { trackLead } from "@/lib/metaPixel"

/**
 * Escucha clics en CTAs "Probar gratis" (marcados con `data-meta-lead`) y
 * dispara el evento Lead. Delegado en document: un solo listener, sin PII.
 */
export function LeadTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-meta-lead]")) trackLead()
    }
    document.addEventListener("click", onClick, { capture: true })
    return () => document.removeEventListener("click", onClick, { capture: true })
  }, [])

  return null
}
