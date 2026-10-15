"use client";

import React from "react";
import { Info } from "lucide-react";

export function precioClp(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

export function textoBotonPagoPlus(monto: number) {
  return `Pagar ${precioClp(monto)} ahora`;
}

const NOTA_ESTANDAR =
  "Tu suscripción Estándar se cancela al confirmar, para no cobrarte dos veces.";

export function plusCheckoutBannerCopy({
  plan = "estandar",
  isTrial = false,
  enEstandarPagado = false,
  monto = 9990,
}: {
  plan?: string;
  isTrial?: boolean;
  enEstandarPagado?: boolean;
  monto?: number;
}) {
  if (plan !== "plus") return null;
  const precio = precioClp(monto);
  if (isTrial) {
    return {
      texto: `Al confirmar, el primer cobro de ${precio} llega al terminar la prueba. Hasta esa fecha sigues con el Plan Plus.`,
      nota: null as string | null,
    };
  }
  if (enEstandarPagado) {
    return {
      texto: `Al confirmar, pasas a Plus y el cobro de ${precio} empieza hoy.`,
      nota: NOTA_ESTANDAR,
    };
  }
  return null;
}

export function PlusCheckoutBanner(props: {
  plan?: string;
  isTrial?: boolean;
  enEstandarPagado?: boolean;
  monto?: number;
}) {
  const copy = plusCheckoutBannerCopy(props);
  if (!copy) return null;
  return (
    <div
      role="status"
      data-testid="plus-cobro-banner"
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <div>
        <p>{copy.texto}</p>
        {copy.nota ? (
          <p data-testid="plus-cobro-nota" className="mt-1 text-[11px] text-amber-800/90 dark:text-amber-200/75">
            {copy.nota}
          </p>
        ) : null}
      </div>
    </div>
  );
}
