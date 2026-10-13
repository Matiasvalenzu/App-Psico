/**
 * Meta (Facebook) Pixel — helper compartido.
 *
 * Reglas de privacidad (datos de salud):
 * - Solo se activa si NEXT_PUBLIC_META_PIXEL_ID está definido (id numérico).
 * - Solo se carga y dispara en rutas de una ALLOWLIST (páginas públicas de
 *   captación/registro). Cualquier otra ruta (dashboard, pacientes, sesiones,
 *   salas, tests, consentimientos, reservas…) queda fuera por defecto.
 * - Solo con consentimiento "accepted" (ver metaConsent.ts): sin él no se carga
 *   fbevents.js ni se envía ningún evento.
 * - Sin PII: sin emails, teléfonos, nombres ni datos clínicos en los eventos,
 *   sin Advanced Matching ni autoConfig (clics/microdata automáticos).
 * - Todas las funciones son no-op seguras si falta el id o `fbq`.
 */

import { hasMetaConsent } from "@/lib/metaConsent"

type Fbq = (...args: unknown[]) => void

declare global {
  interface Window {
    fbq?: Fbq
  }
}

const RAW_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim()

/** Id del píxel validado (solo dígitos) o cadena vacía si no hay/ es inválido. */
export const META_PIXEL_ID = /^\d{6,20}$/.test(RAW_PIXEL_ID) ? RAW_PIXEL_ID : ""

export const isMetaPixelEnabled = META_PIXEL_ID !== ""

/** Evento DOM que dispara el script base cuando `fbq` ya existe. */
export const META_PIXEL_READY_EVENT = "meta-pixel-ready"

/** ALLOWLIST exacta de rutas donde se permite cargar/disparar el píxel. */
const PIXEL_ALLOWED_PATHS: readonly string[] = ["/login", "/suscripcionok"]

function normalizePath(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0] || "/"
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean
}

export function isPixelPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return PIXEL_ALLOWED_PATHS.includes(normalizePath(pathname))
}

function currentPath(): string {
  return typeof window === "undefined" ? "" : window.location.pathname
}

/**
 * Valida al momento de ENVIAR (no al encolar): píxel activo, consentimiento
 * aceptado y ruta ACTUAL del navegador dentro de la allowlist.
 */
function canTrack(): boolean {
  return (
    isMetaPixelEnabled &&
    typeof window !== "undefined" &&
    typeof window.fbq === "function" &&
    hasMetaConsent() &&
    isPixelPath(window.location.pathname)
  )
}

function safeFbq(...args: unknown[]): boolean {
  if (!canTrack()) return false
  try {
    window.fbq!(...args)
    return true
  } catch {
    return false
  }
}

/** Ejecuta `fn` cuando `fbq` exista (o tras el evento ready, máx. 10 s). */
function whenPixelReady(fn: () => void): void {
  if (!isMetaPixelEnabled || typeof window === "undefined") return
  if (typeof window.fbq === "function") {
    fn()
    return
  }
  const onReady = () => {
    window.clearTimeout(timer)
    fn()
  }
  const timer = window.setTimeout(
    () => window.removeEventListener(META_PIXEL_READY_EVENT, onReady),
    10_000,
  )
  window.addEventListener(META_PIXEL_READY_EVENT, onReady, { once: true })
}

let lastPageView = { path: "", at: 0 }

/** PageView (evita duplicados de la misma ruta en < 1,5 s). */
export function trackPageView(pathname: string = currentPath()): void {
  if (!isMetaPixelEnabled || !isPixelPath(pathname)) return
  whenPixelReady(() => {
    const now = Date.now()
    if (lastPageView.path === pathname && now - lastPageView.at < 1500) return
    if (safeFbq("track", "PageView")) {
      lastPageView = { path: pathname, at: now }
    }
  })
}

/** Lead: clic en "Probar gratis". Sin parámetros. */
export function trackLead(): void {
  safeFbq("track", "Lead")
}

/** CompleteRegistration: cuenta nueva creada (OTP o Google). Sin parámetros. */
export function trackCompleteRegistration(): void {
  safeFbq("track", "CompleteRegistration")
}

/** Plan Estándar mensual (CLP) — mismo monto que backend/suscripciones. */
export const SUBSCRIBE_VALUE_CLP = 4990
export const SUBSCRIBE_PLUS_VALUE_CLP = 9990

/** Clave de sessionStorage con el id de la suscripción recién contratada. */
export const SUBSCRIBE_SESSION_KEY = "psx_sub_id"

const subscribeInFlight = new Set<string>()

/**
 * Subscribe: suscripción de pago autorizada (POST /suscripciones/contratar/).
 * No es `Purchase`: durante el trial no hay cobro inmediato.
 * `transactionId` (preapproval_id) se usa como eventID y para no reenviar el
 * evento si el usuario recarga la página. `onSent` se llama solo si ya salió.
 */
export function trackSubscribe(transactionId: string, onSent?: () => void, value = SUBSCRIBE_VALUE_CLP): void {
  const id = transactionId.trim().slice(0, 100)
  if (!id || !isMetaPixelEnabled || typeof window === "undefined") return
  const storageKey = `meta_px_subscribe_${id}`
  try {
    if (window.localStorage.getItem(storageKey)) {
      onSent?.()
      return
    }
  } catch {
    /* almacenamiento no disponible: se continúa */
  }
  if (subscribeInFlight.has(id)) return
  subscribeInFlight.add(id)
  whenPixelReady(() => {
    subscribeInFlight.delete(id)
    const sent = safeFbq(
      "track",
      "Subscribe",
      { value, currency: "CLP" },
      { eventID: id },
    )
    if (!sent) return
    try {
      window.localStorage.setItem(storageKey, "1")
    } catch {
      /* noop */
    }
    onSent?.()
  })
}
