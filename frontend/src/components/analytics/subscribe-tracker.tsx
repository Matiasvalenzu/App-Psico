"use client"

import { useEffect } from "react"

import { useMetaConsent } from "@/lib/metaConsent"
import {
  SUBSCRIBE_SESSION_KEY,
  isMetaPixelEnabled,
  trackSubscribe,
} from "@/lib/metaPixel"

function clearStoredId() {
  try {
    window.sessionStorage.removeItem(SUBSCRIBE_SESSION_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Dispara Subscribe una sola vez tras contratar el plan. El id de la
 * suscripción llega por sessionStorage (no por la URL); sin id no se envía
 * nada (visitas directas / recargas). Limpia el id al enviar o al rechazar.
 */
export function SubscribeTracker() {
  const consent = useMetaConsent()

  useEffect(() => {
    if (consent === "pending") return
    let id = ""
    try {
      id = window.sessionStorage.getItem(SUBSCRIBE_SESSION_KEY) ?? ""
    } catch {
      /* noop */
    }
    if (!id) return
    if (!isMetaPixelEnabled || consent === "rejected") {
      clearStoredId()
      return
    }
    if (consent === "accepted") trackSubscribe(id, clearStoredId)
  }, [consent])

  return null
}
