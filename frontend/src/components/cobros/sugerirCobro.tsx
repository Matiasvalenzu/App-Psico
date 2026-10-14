"use client";

import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function textoSugerencia(monto: number, fecha: string) {
  const [, mes, dia] = fecha.slice(0, 10).split("-");
  const precio = `$${monto.toLocaleString("es-CL")}`;
  return `¿Asociar esta sesión al cobro de ${precio} del ${dia}/${mes}?`;
}

export function SugerenciaCobroBanner({
  texto,
  onAsociar,
  onNo,
}: {
  texto: string;
  onAsociar: () => void;
  onNo: () => void;
}) {
  return (
    <div
      role="status"
      data-testid="sugerencia-cobro"
      className="flex w-[22rem] flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-lg"
    >
      <p>{texto}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onNo}>
          No
        </Button>
        <Button type="button" size="sm" onClick={onAsociar}>
          Asociar
        </Button>
      </div>
    </div>
  );
}

export async function sugerirAsociarCobro(pacienteId: number, sesionId: number, fecha: string) {
  const res = await apiFetch(
    `/facturacion/cobros/sugerencia/?paciente=${pacienteId}&fecha=${encodeURIComponent(fecha)}`,
  );
  if (!res.ok) return;
  const data = await res.json().catch(() => null);
  const cobro = data?.cobro;
  if (!cobro?.id || !cobro.fecha_pago) return;
  const texto = textoSugerencia(cobro.monto_bruto, cobro.fecha_pago);
  toast.custom(
    (id) => (
      <SugerenciaCobroBanner
        texto={texto}
        onNo={() => toast.dismiss(id)}
        onAsociar={async () => {
          toast.dismiss(id);
          const alta = await apiFetch(`/facturacion/cobros/${cobro.id}/vincular-sesiones/`, {
            method: "POST",
            body: JSON.stringify({ sesiones: [sesionId] }),
          });
          if (alta.ok) toast.success("Sesión asociada al cobro.");
          else toast.error("No se pudo asociar la sesión.");
        }}
      />
    ),
    { duration: 20000 },
  );
}
