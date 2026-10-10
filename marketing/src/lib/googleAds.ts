/**
 * Google Ads (gtag.js) — helper compartido (marketing/ y frontend/).
 *
 * Reglas de privacidad (datos de salud):
 * - Solo se activa si NEXT_PUBLIC_GOOGLE_ADS_ID está definido (formato AW-123456789).
 * - Mismo consentimiento que el Meta Pixel (metaConsent.ts) y misma ALLOWLIST de
 *   rutas (isPixelPath): fuera de ella (dashboard, pacientes, sesiones…) nunca
 *   se carga ni se dispara nada.
 * - Sin consentimiento "accepted" NO se descarga gtag.js ni se envía ningún evento.
 * - Google Consent Mode v2: todo en 'denied' por defecto; al cargar (solo tras
 *   aceptar) se concede ad_storage y ad_user_data (medición de conversiones).
 *   ad_personalization y analytics_storage permanecen en 'denied'.
 * - Sin PII: sin Enhanced Conversions, sin emails/teléfonos/nombres ni datos
 *   clínicos. No se envían page_view (solo conversiones).
 * - Un evento solo sale si su etiqueta `send_to` está completa (ver más abajo).
 * - Todas las funciones son no-op seguras si falta el id o `gtag`.
 */

import { hasMetaConsent } from "@/lib/metaConsent"
import { isPixelPath } from "@/lib/metaPixel"

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: Gtag
    dataLayer?: unknown[]
  }
}

const RAW_GOOGLE_ADS_ID = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "").trim()

/** Id de la etiqueta validado (AW-<dígitos>) o cadena vacía si no hay/ es inválido. */
export const GOOGLE_ADS_ID = /^AW-\d{6,15}$/.test(RAW_GOOGLE_ADS_ID) ? RAW_GOOGLE_ADS_ID : ""

export const isGoogleAdsEnabled = GOOGLE_ADS_ID !== ""

/** Evento DOM que dispara el script base cuando `gtag` ya existe. */
export const GOOGLE_ADS_READY_EVENT = "google-ads-ready"

export type GoogleAdsConversionName =
  | "registro_app"
  | "clic_probar_gratis"
  | "suscripcion_pagada"

/**
 * Etiquetas `send_to` por conversión (formato `AW-18504135969/<etiqueta>`).
 * Etiquetas de las conversiones "... Web" (sitio web). Si un valor queda
 * vacío (o no es `<GOOGLE_ADS_ID>/<etiqueta>`), esa conversión NO se dispara.
 *
 * IDs de conversión en la cuenta 499-465-5197 (solo referencia):
 *  - registro_app (principal): 7833257213
 *  - clic_probar_gratis (secundaria): 7833257219
 *  - suscripcion_pagada (secundaria): 7833257216
 */
export const GOOGLE_ADS_SEND_TO: Record<GoogleAdsConversionName, string> = {
  registro_app: "AW-18504135969/HTPtCLaLqJgdEKHquvdE", // "Registro app Web"
  clic_probar_gratis: "AW-18504135969/OBzCCLmLqJgdEKHquvdE", // "Clic Probar gratis Web"
  suscripcion_pagada: "AW-18504135969/-XFUCLyLqJgdEKHquvdE", // "Suscripcion pagada Web"
}

/** `send_to` válido para la conversión o cadena vacía si falta/ es inválido. */
export function getSendTo(name: GoogleAdsConversionName): string {
  const value = (GOOGLE_ADS_SEND_TO[name] ?? "").trim()
  if (!isGoogleAdsEnabled || !value) return ""
  const prefix = `${GOOGLE_ADS_ID}/`
  return value.startsWith(prefix) && /^[A-Za-z0-9_-]{4,}$/.test(value.slice(prefix.length))
    ? value
    : ""
}

/**
 * Valida al momento de ENVIAR: etiqueta activa, consentimiento aceptado y ruta
 * ACTUAL del navegador dentro de la allowlist.
 */
function canTrack(): boolean {
  return (
    isGoogleAdsEnabled &&
    typeof window !== "undefined" &&
    typeof window.gtag === "function" &&
    hasMetaConsent() &&
    isPixelPath(window.location.pathname)
  )
}

function safeConversion(
  name: GoogleAdsConversionName,
  params: Record<string, unknown> = {},
): boolean {
  const sendTo = getSendTo(name)
  if (!sendTo || !canTrack()) return false
  try {
    window.gtag!("event", "conversion", { send_to: sendTo, ...params })
    return true
  } catch {
    return false
  }
}

/** Ejecuta `fn` cuando `gtag` exista (o tras el evento ready, máx. 10 s). */
export function whenGoogleAdsReady(fn: () => void): void {
  if (!isGoogleAdsEnabled || typeof window === "undefined") return
  if (typeof window.gtag === "function") {
    fn()
    return
  }
  const onReady = () => {
    window.clearTimeout(timer)
    fn()
  }
  const timer = window.setTimeout(
    () => window.removeEventListener(GOOGLE_ADS_READY_EVENT, onReady),
    10_000,
  )
  window.addEventListener(GOOGLE_ADS_READY_EVENT, onReady, { once: true })
}

/**
 * Conversión sin parámetros (registro_app, clic_probar_gratis). No dispara si
 * falta la etiqueta, el consentimiento o la ruta no está en la allowlist.
 * Para `suscripcion_pagada` usa `trackGoogleAdsSubscribe` (value + dedupe).
 */
export function trackGoogleAdsConversion(name: GoogleAdsConversionName): boolean {
  if (name === "suscripcion_pagada") return false
  return safeConversion(name)
}
