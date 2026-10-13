export type BheModo = "RETENCION_POR_EMISOR" | "RECEPTOR_RETIENE" | "SIN_DATOS_RECEPTOR";
export type EstadoBoleta = "PENDIENTE" | "EN_EMISION" | "EMITIDA" | "ANULADA" | "NO_APLICA";
export type EstadoPago = "PENDIENTE" | "PAGADO";
export type EstadoEmision =
  | "PENDIENTE"
  | "EN_CURSO"
  | "EMITIDA"
  | "REGISTRADA"
  | "DESCONOCIDO"
  | "FALLIDA"
  | "CANCELADA"
  | "ANULADA";

export interface EmisionBHE {
  id: number;
  tipo: "EMISION" | "ANULACION";
  estado: EstadoEmision;
  intentos: number;
  folio: string;
  error_codigo: string;
  error_detalle: string;
  revision_manual: boolean;
  monto_retencion_sii: number | null;
  monto_liquido_sii: number | null;
  tiene_pdf: boolean;
  created_at: string;
  finished_at: string | null;
  resuelta_at: string | null;
}

// Lo que usa la ficha de GET /facturacion/delegacion/: si hay motivo de bloqueo, no se puede emitir en el SII.
export interface DelegacionBHE {
  estado: string;
  motivo_bloqueo: string | null;
  mensaje_bloqueo: string | null;
}

export interface Cobro {
  id: number;
  paciente: number | null;
  paciente_nombre: string;
  sesion: number | null;
  fecha_pago: string;
  monto_bruto: number;
  medio_pago: "EFECTIVO" | "TRANSFERENCIA" | "OTRO";
  estado_pago: EstadoPago;
  pagado_el: string | null;
  ultimo_cambio_pago: { estado: EstadoPago; usuario: string; fecha: string } | null;
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
  plazo_anulacion_vencido: boolean | null;
  anulacion_solicitada_at: string | null;
  ultima_emision: EmisionBHE | null;
  receptor_desactualizado: boolean;
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
  EN_EMISION: { label: "En emisión", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  EMITIDA: { label: "Emitida", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  ANULADA: { label: "Anulada", className: "bg-muted text-muted-foreground line-through" },
  NO_APLICA: { label: "No aplica", className: "bg-muted text-muted-foreground" },
};

export const ESTADOS_PAGO: Record<EstadoPago | "SIN_COBRO", { label: string; className: string }> = {
  PAGADO: { label: "Pagado", className: ESTADOS_BOLETA.EMITIDA.className },
  PENDIENTE: { label: "Pendiente", className: ESTADOS_BOLETA.PENDIENTE.className },
  SIN_COBRO: { label: "Sin cobro", className: ESTADOS_BOLETA.NO_APLICA.className },
};

// Chip de boleta en las listas: la que falta emitir o no aplica cuenta como «Sin boleta».
export function chipBoleta(estado: EstadoBoleta | null | undefined, folio = "") {
  if (estado === "EMITIDA") {
    return { label: folio ? `Emitida · folio ${folio}` : "Emitida", className: ESTADOS_BOLETA.EMITIDA.className };
  }
  if (estado === "EN_EMISION" || estado === "ANULADA") return ESTADOS_BOLETA[estado];
  return { label: "Sin boleta", className: ESTADOS_BOLETA.NO_APLICA.className };
}

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

// Lo mismo que exige el backend para emitir en el SII: RUT, nombre, dirección y comuna.
export function receptorListoParaSii(cobro: Cobro) {
  return (
    cobro.bhe_modo !== "SIN_DATOS_RECEPTOR" &&
    cobro.receptor_tipo_doc === "RUT" &&
    [cobro.receptor_documento, cobro.receptor_nombre, cobro.receptor_direccion, cobro.receptor_comuna].every((c) => c?.trim())
  );
}
