"use client"

import { useEffect } from "react"

import { trackPurchase } from "@/lib/metaPixel"

/**
 * Dispara Purchase al volver de Mercado Pago. Requiere un identificador de
 * transacción en la URL (preapproval_id / payment_id / collection_id); sin él
 * no se envía nada (evita compras falsas por visitas directas).
 */
export function PurchaseTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id =
      params.get("preapproval_id") ||
      params.get("payment_id") ||
      params.get("collection_id")
    if (id) trackPurchase(id)
  }, [])

  return null
}
