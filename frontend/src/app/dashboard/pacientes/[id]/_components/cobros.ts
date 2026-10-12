export type BheModo = "RETENCION_POR_EMISOR" | "RECEPTOR_RETIENE" | "SIN_DATOS_RECEPTOR";
export type EstadoBoleta = "PENDIENTE" | "EMITIDA" | "ANULADA" | "NO_APLICA";

export interface Cobro {
  id: number;
  paciente: number | null;
  paciente_nombre: string;
  sesion: number | null;
  fecha_pago: string;
  monto_bruto: number;
  medio_pago: "EFECTIVO" | "TRANSFERENCIA" | "OTRO";
  estado_pago: "PENDIENTE" | "PAGADO";
  receptor_tipo_doc: string;
  receptor_documento: string;
  receptor_nombre: string;
  receptor_direccion: string;
  receptor_comuna: string;
  receptor_email: string;
  glosa: string;
  bhe_modo: BheModo;
  tasa_retencion: string;
  monto_retencion: number;
  monto_liquido: number;
  estado_boleta: EstadoBoleta;
  boleta_folio: string;
  boleta_fecha_emision: string | null;
  boleta_anulada_at: string | null;
  anulable_hasta: string | null;
  notas: string;
}

export const MEDIOS_PAGO = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", OTRO: "Otro" } as const;

export const MODOS_BOLETA: Record<BheModo, string> = {
  RETENCION_POR_EMISOR: "Retención a cargo tuyo",
  RECEPTOR_RETIENE: "El receptor retiene",
  SIN_DATOS_RECEPTOR: "Sin datos del receptor",
};

export const ESTADOS_BOLETA: Record<EstadoBoleta, { label: string; className: string }> = {
  PENDIENTE: { label: "Por emitir", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  EMITIDA: { label: "Emitida", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  ANULADA: { label: "Anulada", className: "bg-muted text-muted-foreground line-through" },
  NO_APLICA: { label: "No aplica", className: "bg-muted text-muted-foreground" },
};

export function formatCLP(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// La boleta no se puede marcar emitida sin RUT y nombre del receptor (o del tutor, si es menor).
export function receptorIncompleto(cobro: Cobro) {
  return cobro.bhe_modo !== "SIN_DATOS_RECEPTOR" && (!cobro.receptor_documento || !cobro.receptor_nombre);
}
