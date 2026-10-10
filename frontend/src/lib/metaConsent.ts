/**
 * Consentimiento para el Meta Pixel (compartido entre marketing/ y frontend/).
 *
 * - Sin consentimiento "accepted" NO se carga fbevents.js ni se envía nada.
 * - La elección se guarda en localStorage y en una cookie `Domain=.psiconex.cl`
 *   (compartida entre psiconex.cl y app.psiconex.cl). Fuera de ese dominio
 *   (p. ej. localhost) la cookie queda solo en el origen actual.
 * - La cookie tiene prioridad sobre localStorage (refleja el último cambio hecho
 *   en cualquiera de los dos orígenes).
 */
import { useSyncExternalStore } from "react"

export const META_CONSENT_KEY = "psiconex_consent_meta"
export const META_CONSENT_EVENT = "psiconex-consent-change"

export type StoredConsent = "accepted" | "rejected"
/** `pending` solo existe en el servidor / antes de hidratar. */
export type ConsentState = StoredConsent | "unset" | "pending"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function isStored(value: unknown): value is StoredConsent {
  return value === "accepted" || value === "rejected"
}

function readCookie(): StoredConsent | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${META_CONSENT_KEY}=`))
    const value = match ? decodeURIComponent(match.split("=")[1] ?? "") : ""
    return isStored(value) ? value : null
  } catch {
    return null
  }
}

/** Elección guardada o `null` si el usuario aún no decide. */
export function getStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null
  const fromCookie = readCookie()
  if (fromCookie) return fromCookie
  try {
    const value = window.localStorage.getItem(META_CONSENT_KEY)
    return isStored(value) ? value : null
  } catch {
    return null
  }
}

export function hasMetaConsent(): boolean {
  return getStoredConsent() === "accepted"
}

export function setMetaConsent(value: StoredConsent): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(META_CONSENT_KEY, value)
  } catch {
    /* almacenamiento no disponible */
  }
  try {
    const host = window.location.hostname
    const shared = host === "psiconex.cl" || host.endsWith(".psiconex.cl")
    const parts = [
      `${META_CONSENT_KEY}=${value}`,
      "Path=/",
      `Max-Age=${MAX_AGE_SECONDS}`,
      "SameSite=Lax",
    ]
    if (shared) parts.push("Domain=.psiconex.cl")
    if (window.location.protocol === "https:") parts.push("Secure")
    document.cookie = parts.join("; ")
  } catch {
    /* cookies no disponibles */
  }
  window.dispatchEvent(new Event(META_CONSENT_EVENT))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(META_CONSENT_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(META_CONSENT_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function getSnapshot(): ConsentState {
  return getStoredConsent() ?? "unset"
}

function getServerSnapshot(): ConsentState {
  return "pending"
}

/** Estado reactivo del consentimiento (`pending` hasta hidratar). */
export function useMetaConsent(): ConsentState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
