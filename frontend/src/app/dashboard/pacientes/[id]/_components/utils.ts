// Tipos y helpers compartidos por la ficha del paciente.

import { apiFetch } from "@/lib/api";

export interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  rut: string;
  edad: number | null;
  sexo: string;
  ocupacion_laboral: string;
  motivo_consulta: string;
  telefono_whatsapp: string;
  email_contacto: string;
  nacionalidad: string;
  religion: string;
  direccion: string;
  comuna: string;
  prevision: string;
  es_menor_edad: boolean;
  nombre_tutor: string;
  telefono_tutor: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  origen_consulta: string;
  derivacion_interconsulta: string;
  diagnostico_sospechado: string;
  medicacion_actual: string;
  riesgo_suicida: boolean;
  ideacion_suicida_nivel: number | null;
  frecuencia_atencion: string;
  objetivos_intervencion: string;
  notas_privadas: string;
  estado: string;
  activo: boolean;
  consentimiento_estado?: string | null;
  consentimiento_id?: number | null;
  consentimiento_fecha_firma?: string | null;
  created_at: string;
}

export interface Sesion {
  id: number;
  numero_sesion: number | null;
  fecha_hora_inicio: string;
  duracion_segundos: number | null;
  origen: "AUDIO" | "DOCUMENTO_EXTERNO" | "VIRTUAL" | "TEST_PSICOLOGICO";
  documento_nombre_original: string;
  estado: string;
}

export interface SegmentoDocumento {
  id: number;
  orden: number;
  texto: string;
}

export interface DocumentoExternoDetalle extends Sesion {
  segmentos: SegmentoDocumento[];
}

export interface ChatMensaje {
  id: number;
  rol: "USER" | "ASSISTANT";
  contenido: string;
  fuentes_json: Array<{
    segmento_id: number;
    sesion_id: number;
    fecha: string;
    origen: string;
    documento_nombre_original: string;
    hablante: string;
    texto: string;
  }>;
}

export interface ChatConversacion {
  id: number;
  paciente: number;
  titulo: string;
  mensajes_count?: number;
  mensajes?: ChatMensaje[];
  created_at: string;
  updated_at: string;
}

export interface InformeIA {
  id: number;
  paciente: number;
  titulo: string;
  tipo: string;
  contenido: string;
  created_at: string;
}

export const CHAT_SUGGESTED_PROMPTS = [
  "Elabora un informe clínico breve del proceso terapéutico de este paciente.",
  "Genera un resumen clínico con temas trabajados, indicadores relevantes y límites de la información disponible.",
  "Analiza el caso y sugiere objetivos pendientes para las próximas sesiones.",
  "Prepara la próxima sesión considerando avances, alertas o riesgos y focos de intervención.",
];

export interface TestSendResult {
  id: number;
  public_url: string;
  token?: string;
  email_enviado: boolean;
  email_error: string;
  email_configurado: boolean;
  fecha_expiracion: string;
}

export interface CatalogTestItem {
  slug: string;
  name: string;
  short_name?: string;
  duration_minutes: number;
  description: string;
  tipo_evaluacion?: string;
}

export function getDateTimeInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function getApiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const entries = Object.values(data as Record<string, unknown>);
  const first = entries[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  if (typeof first === "string") return first;
  return fallback;
}

export function deduplicateSources(
  sources: Array<{ sesion_id: number; fecha: string; origen: string; documento_nombre_original: string; hablante: string; texto: string }>
) {
  const seen = new Map<number, (typeof sources)[0]>();
  for (const src of sources) {
    if (!seen.has(src.sesion_id)) {
      seen.set(src.sesion_id, src);
    }
  }
  return Array.from(seen.values());
}

export function formatRelativeTime(dateString: string) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export function calcularEdad(fecha: string): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  const nac = new Date(fecha);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

export function getSexoLabel(sexo: string) {
  const map: Record<string, string> = {
    M: "Masculino",
    F: "Femenino",
    O: "Otro",
    N: "Prefiero no decir",
  };
  return map[sexo] || sexo;
}

export function formatDateInputValue(dateStr: string | null) {
  if (!dateStr) return "";
  return dateStr.split("T")[0];
}

export function getStatusBadge(status: string) {
  if (status === "COMPLETADO") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  if (status === "PROCESANDO") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "bg-muted text-muted-foreground";
}

export function getPacienteEstadoLabel(status?: string | null) {
  const map: Record<string, string> = {
    EN_SESION: "Activo",
    ALTA: "Alta",
    ABANDONO: "Abandono",
    PAUSADO: "Pausado",
    DERIVADO: "Derivado",
  };
  if (!status) return "Activo";
  return map[status] || status;
}

export function getStatusLabel(status: string) {
  if (status === "COMPLETADO") return "Completado";
  if (status === "PROCESANDO") return "Procesando";
  if (status === "PENDIENTE") return "Pendiente";
  if (status === "ERROR") return "Error";
  return status;
}


export function getInformeTipoLabel(tipo: string) {
  const map: Record<string, string> = {
    RESUMEN_CLINICO: "Resumen clínico",
    EVOLUCION: "Evolución",
    PROXIMA_SESION: "Próxima sesión",
    OTRO: "Otro",
  };
  return map[tipo] || tipo;
}

export function safeFilename(value: string) {
  return (value || "informe-ia")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "informe-ia";
}

export function cleanMarkdownEmphasis(text: string) {
  return (text || "")
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => value.trim().toUpperCase())
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

export async function downloadResponse(res: Response, filename: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function tieneRiesgo(p: Paciente) {
  return Boolean(p.riesgo_suicida || (p.ideacion_suicida_nivel && p.ideacion_suicida_nivel > 0));
}

// La API pagina de a 20: recorre todas las páginas. Lanza error si alguna respuesta falla.
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 1; ; page++) {
    const res = await apiFetch(`${path}${sep}page=${page}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    all.push(...(data.results || []));
    if (!data.next) return all;
  }
}
