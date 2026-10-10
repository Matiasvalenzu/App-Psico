/**
 * Meta (Facebook) Pixel — helper compartido.
 *
 * Reglas de privacidad (datos de salud):
 * - Solo se activa si NEXT_PUBLIC_META_PIXEL_ID está definido (id numérico).
 * - Solo se carga y dispara en rutas de una ALLOWLIST (páginas públicas de
 *   captación/registro). Cualquier otra ruta (dashboard, pacientes, sesiones,
 *   salas, tests, consentimientos, reservas…) queda fuera por defecto.
 * - Sin PII: sin emails, teléfonos, nombres ni datos clínicos en los eventos,
 *   sin Advanced Matching ni autoConfig (clics/microdata automáticos).
 * - Todas las funciones son no-op seguras si falta el id o `fbq`.
 */

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
const PIXEL_ALLOWED_PATHS: readonly string[] = ["/", "/privacidad", "/terminos", "/suscripcionok"]

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

function canTrack(pathname: string): boolean {
  return (
    isMetaPixelEnabled &&
    typeof window !== "undefined" &&
    typeof window.fbq === "function" &&
    isPixelPath(pathname)
  )
}

function safeFbq(pathname: string, ...args: unknown[]): boolean {
  if (!canTrack(pathname)) return false
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
    if (safeFbq(pathname, "track", "PageView")) {
      lastPageView = { path: pathname, at: now }
    }
  })
}

/** Lead: clic en "Probar gratis". Sin parámetros. */
export function trackLead(): void {
  safeFbq(currentPath(), "track", "Lead")
}

/** CompleteRegistration: cuenta nueva creada (OTP o Google). Sin parámetros. */
export function trackCompleteRegistration(): void {
  safeFbq(currentPath(), "track", "CompleteRegistration")
}

/** Plan Estándar mensual (CLP) — mismo monto que backend/suscripciones. */
export const PURCHASE_VALUE_CLP = 4990

/**
 * Purchase al volver de Mercado Pago a /suscripcionok.
 * `transactionId` se usa como eventID (deduplicación) y para no reenviar el
 * evento si el usuario recarga la página.
 */
export function trackPurchase(transactionId: string): void {
  const id = transactionId.trim().slice(0, 100)
  if (!id || !isMetaPixelEnabled || typeof window === "undefined") return
  const storageKey = `meta_px_purchase_${id}`
  try {
    if (window.localStorage.getItem(storageKey)) return
  } catch {
    /* almacenamiento no disponible: se continúa */
  }
  const path = currentPath()
  whenPixelReady(() => {
    const sent = safeFbq(
      path,
      "track",
      "Purchase",
      { value: PURCHASE_VALUE_CLP, currency: "CLP" },
      { eventID: id },
    )
    if (!sent) return
    try {
      window.localStorage.setItem(storageKey, "1")
    } catch {
      /* noop */
    }
  })
}

/**
 * Indica si el perfil (`/auth/me/`) corresponde a una cuenta recién creada:
 * trial vigente con ≥ ~13,9 días restantes (el backend fija 14 días al crear).
 * Sirve para el login con Google, cuyo endpoint no devuelve `is_new_user`.
 */
export function isFreshlyCreatedAccount(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false
  const p = profile as { suscripcion_estado?: unknown; fin_prueba?: unknown }
  if (p.suscripcion_estado !== "trial" || typeof p.fin_prueba !== "string") {
    return false
  }
  const end = Date.parse(p.fin_prueba)
  if (Number.isNaN(end)) return false
  const trialMs = 14 * 24 * 60 * 60 * 1000
  const windowMs = 10 * 60 * 1000
  return end - Date.now() > trialMs - windowMs
}
