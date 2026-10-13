"use client"

import { useEffect } from "react"

import { isGoogleAdsEnabled, trackGoogleAdsSubscribe } from "@/lib/googleAds"
import { useMetaConsent } from "@/lib/metaConsent"
import {
  SUBSCRIBE_PLUS_VALUE_CLP,
  SUBSCRIBE_SESSION_KEY,
  SUBSCRIBE_VALUE_CLP,
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
 * Dispara Subscribe (Meta) y la conversión "Suscripción pagada" (Google Ads) una sola vez tras contratar el plan. El id de la
 * suscripción llega por sessionStorage (no por la URL); sin id no se envía
 * nada (visitas directas / recargas). Limpia el id al enviar o al rechazar.
 * El enlace de Plus no pasa por la app: su id llega como `transactionId`.
 */
export function SubscribeTracker({ transactionId, plus }: { transactionId?: string; plus?: boolean } = {}) {
  const consent = useMetaConsent()
  const value = plus ? SUBSCRIBE_PLUS_VALUE_CLP : SUBSCRIBE_VALUE_CLP

  useEffect(() => {
    if (consent === "pending") return
    let id = ""
    try {
      id = transactionId || (window.sessionStorage.getItem(SUBSCRIBE_SESSION_KEY) ?? "")
    } catch {
      /* noop */
    }
    if (!id) return
    if (!(isMetaPixelEnabled || isGoogleAdsEnabled) || consent === "rejected") {
      clearStoredId()
      return
    }
    if (consent === "accepted") {
      // El id se borra de sessionStorage cuando todos los destinos activos
      // terminaron (Meta y/o Google Ads), para que ninguno lo pierda.
      let pending = (isMetaPixelEnabled ? 1 : 0) + (isGoogleAdsEnabled ? 1 : 0)
      const done = () => {
        pending -= 1
        if (pending <= 0) clearStoredId()
      }
      if (isMetaPixelEnabled) trackSubscribe(id, done, value)
      if (isGoogleAdsEnabled) trackGoogleAdsSubscribe(id, done, value)
    }
  }, [consent, transactionId, value])

  return null
}
