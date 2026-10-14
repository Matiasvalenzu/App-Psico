export const ATRIBUCION_COOKIE = "psiconex_atribucion";
const MAX_AGE = 60 * 60 * 24 * 30;
const CAMPOS = ["utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid"] as const;

export type Atribucion = Partial<Record<(typeof CAMPOS)[number], string>>;

function leerCookie(): Atribucion | null {
  try {
    const match = document.cookie.split("; ").find((part) => part.startsWith(`${ATRIBUCION_COOKIE}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.slice(ATRIBUCION_COOKIE.length + 1));
    const data = JSON.parse(raw) as Atribucion;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function escribirCookie(data: Atribucion) {
  const host = window.location.hostname;
  const shared = host === "psiconex.cl" || host.endsWith(".psiconex.cl");
  const parts = [
    `${ATRIBUCION_COOKIE}=${encodeURIComponent(JSON.stringify(data))}`,
    "Path=/",
    `Max-Age=${MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (shared) parts.push("Domain=.psiconex.cl");
  if (window.location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

export function capturarAtribucion() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const incoming: Atribucion = {};
  for (const campo of CAMPOS) {
    const value = (params.get(campo) || "").trim().slice(0, 200);
    if (value) incoming[campo] = value;
  }
  if (!Object.keys(incoming).length || leerCookie()) return;
  escribirCookie(incoming);
}

export function leerAtribucion(): Atribucion {
  if (typeof window === "undefined") return {};
  return leerCookie() || {};
}
