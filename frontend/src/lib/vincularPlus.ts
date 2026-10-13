import { apiFetch, getAccessToken } from "@/lib/api";

// Id del preapproval que trae Mercado Pago al volver del enlace de Plus, guardado hasta que haya sesión.
export const PREAPPROVAL_PENDIENTE_KEY = "psiconex_preapproval_pendiente";

export function guardarPreapprovalPendiente(id: string) {
  try {
    localStorage.setItem(PREAPPROVAL_PENDIENTE_KEY, id);
  } catch {
    /* localStorage no disponible */
  }
}

export function leerPreapprovalPendiente(): string {
  try {
    return localStorage.getItem(PREAPPROVAL_PENDIENTE_KEY) || "";
  } catch {
    return "";
  }
}

/** Asocia el pago del enlace de Plus a la cuenta con sesión iniciada. Devuelve null si quedó vinculado o el mensaje de error. */
export async function vincularPreapproval(id: string): Promise<string | null> {
  if (!getAccessToken()) return "Inicia sesión para activar tu plan.";
  try {
    const res = await apiFetch("/suscripciones/vincular/", {
      method: "POST",
      body: JSON.stringify({ preapproval_id: id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return data?.error || "No pudimos activar tu plan.";
    try {
      localStorage.removeItem(PREAPPROVAL_PENDIENTE_KEY);
    } catch {
      /* noop */
    }
    return null;
  } catch {
    return "No pudimos comunicarnos con el servidor.";
  }
}
