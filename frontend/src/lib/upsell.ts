import { GOOGLE_ADS_READY_EVENT } from "@/lib/googleAds"
import { META_PIXEL_READY_EVENT } from "@/lib/metaPixel"

export type OrigenUpsell = "dashboard" | "cobros_ficha" | "lista_pacientes" | "menu"
export type EventoUpsell = "upsell_plus_click" | "upsell_plus_cta"

const COLA = "psx_upsell_events"
const RUTA = "/dashboard/suscripcion"

function rutaMedicion() {
  if (typeof window === "undefined") return false
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  return path === RUTA || path === "/login" || path === "/suscripcionok"
}

function enviar(evento: EventoUpsell, origen: OrigenUpsell) {
  if (!rutaMedicion() || typeof window === "undefined") return false
  const params = { origen }
  let salio = false
  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", evento, params)
    salio = true
  }
  if (typeof window.gtag === "function") {
    window.gtag("event", evento, params)
    salio = true
  }
  return salio
}

function cola(): { evento: EventoUpsell; origen: OrigenUpsell }[] {
  try {
    const data = JSON.parse(sessionStorage.getItem(COLA) || "[]")
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function trackUpsell(evento: EventoUpsell, origen: OrigenUpsell) {
  if (enviar(evento, origen) || typeof window === "undefined") return
  const siguiente = [...cola(), { evento, origen }].slice(-8)
  sessionStorage.setItem(COLA, JSON.stringify(siguiente))
}

export function flushUpsell() {
  const pendientes = cola().filter((item) => !enviar(item.evento, item.origen))
  if (typeof window === "undefined") return
  sessionStorage.setItem(COLA, JSON.stringify(pendientes))
  if (pendientes.length) {
    window.addEventListener(META_PIXEL_READY_EVENT, flushUpsell, { once: true })
    window.addEventListener(GOOGLE_ADS_READY_EVENT, flushUpsell, { once: true })
  }
}
