// Opciones de fondo para la videollamada y preferencia guardada (sin dependencias del navegador
// salvo localStorage, para poder probarlo con node:test).

export type FondoId =
  | "ninguno"
  | "difuminar-suave"
  | "difuminar-fuerte"
  | "consulta"
  | "biblioteca"
  | "living"
  | "neutro"
  | "naturaleza";

export type FondoEfecto =
  | { tipo: "ninguno" }
  | { tipo: "difuminar"; intensidad: "suave" | "fuerte" }
  | { tipo: "imagen"; src: string };

export interface FondoOpcion {
  id: FondoId;
  nombre: string;
  miniatura?: string;
  efecto: FondoEfecto;
}

const img = (id: FondoId, nombre: string): FondoOpcion => ({
  id,
  nombre,
  miniatura: `/fondos/${id}-thumb.webp`,
  efecto: { tipo: "imagen", src: `/fondos/${id}.webp` },
});

export const FONDOS: FondoOpcion[] = [
  { id: "ninguno", nombre: "Sin efecto", efecto: { tipo: "ninguno" } },
  { id: "difuminar-suave", nombre: "Difuminar suave", efecto: { tipo: "difuminar", intensidad: "suave" } },
  { id: "difuminar-fuerte", nombre: "Difuminar fuerte", efecto: { tipo: "difuminar", intensidad: "fuerte" } },
  img("consulta", "Consulta"),
  img("biblioteca", "Biblioteca"),
  img("living", "Living con plantas"),
  img("neutro", "Degradado neutro"),
  img("naturaleza", "Naturaleza"),
];

export const FONDO_STORAGE_KEY = "psiconex.fondoVideollamada";

export function fondoPorId(id: string | null | undefined): FondoOpcion {
  return FONDOS.find((f) => f.id === id) || FONDOS[0];
}

export function leerFondoGuardado(storage?: Pick<Storage, "getItem"> | null): FondoId {
  try {
    const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    return fondoPorId(s?.getItem(FONDO_STORAGE_KEY)).id;
  } catch {
    return "ninguno";
  }
}

export function guardarFondo(id: FondoId, storage?: Pick<Storage, "setItem"> | null) {
  try {
    const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    s?.setItem(FONDO_STORAGE_KEY, id);
  } catch {}
}

/** Recorte "cover": rectángulo de origen para llenar dw×dh sin deformar. */
export function cubrir(sw: number, sh: number, dw: number, dh: number) {
  const escala = Math.max(dw / sw, dh / sh);
  const w = dw / escala;
  const h = dh / escala;
  return { sx: (sw - w) / 2, sy: (sh - h) / 2, sw: w, sh: h };
}

/** Tamaño de salida: máximo 640 px en el lado largo, conservando la proporción de la cámara. */
export function tamanoSalida(w: number, h: number, max = 640) {
  if (!w || !h) return { width: 640, height: 360 };
  const escala = Math.min(1, max / Math.max(w, h));
  return { width: Math.round((w * escala) / 2) * 2, height: Math.round((h * escala) / 2) * 2 };
}
