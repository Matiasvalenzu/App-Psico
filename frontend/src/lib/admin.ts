import { apiFetch } from "@/lib/api";

export type AdminQuery = Record<string, string | number | boolean | undefined | null>;

function params(query: AdminQuery = {}) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 403) throw new Error("No tienes permiso para ver esta sección.");
  if (!res.ok) throw new Error("No se pudo cargar el panel.");
  return res.json();
}

export function getAdminResumen() {
  return adminGet<AdminResumen>("/cuenta/admin/resumen/");
}

export function getAdminUsuarios(query: AdminQuery) {
  return adminGet<AdminUsuariosPage>(`/cuenta/admin/usuarios/${params(query)}`);
}

export function getAdminUsuario(id: number) {
  return adminGet<AdminUsuarioDetalle>(`/cuenta/admin/usuarios/${id}/`);
}

export function marcarCuentaInterna(id: number, esInterna: boolean) {
  return apiFetch(`/cuenta/admin/usuarios/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ es_interna: esInterna }),
  }).then(async (res) => {
    if (!res.ok) throw new Error("No se pudo actualizar la cuenta.");
    return res.json();
  });
}

export function getAdminIngresos() {
  return adminGet<AdminIngresos>("/cuenta/admin/ingresos/");
}

export function getAdminUso() {
  return adminGet<AdminUso>("/cuenta/admin/uso/");
}

export function getAdminEmbudo() {
  return adminGet<AdminEmbudo>("/cuenta/admin/embudo/");
}

export async function exportarUsuarios(query: AdminQuery) {
  const res = await apiFetch(`/cuenta/admin/usuarios/export/${params(query)}`);
  if (!res.ok) throw new Error("No se pudo exportar.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "usuarios-psiconex.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatUsd(value: number) {
  if (!value) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatFechaSantiago(value: string | null | undefined, withTime = false) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  const parts = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const fecha = `${get("day")}/${get("month")}/${get("year")}`;
  if (!withTime) return fecha;
  return `${fecha} ${get("hour")}:${get("minute")}`;
}

export function haceDias(value: string | null | undefined) {
  if (!value) return "sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin actividad";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

export interface AdminPersona {
  id: number;
  email: string;
  nombre: string;
}

export interface AdminResumen {
  registros: { hoy: number; dias_7: number; dias_30: number };
  activos: { dias_7: number; dias_30: number };
  en_prueba: number;
  pagados_por_plan: Record<string, { nombre: string; cuentas: number; mrr_clp: number }>;
  mrr_clp: number;
  cancelaciones_mes: number;
  pagos_fallidos: number;
  serie_semanal: { semana: string; registros: number; activaciones: number }[];
  alertas: {
    prueba_por_vencer: (AdminPersona & { fin_prueba: string | null; dias: number | null })[];
    prueba_sin_paciente: AdminPersona[];
    pagando_sin_entrar: AdminPersona[];
    pago_fallido: (AdminPersona & { inactiva_desde: string | null })[];
    plus_sin_vincular: { id: number; preapproval_id: string; estado_mp: string; creado_en: string | null }[];
    transcripciones_fallidas_24h: {
      total: number;
      por_profesional: (AdminPersona & { cantidad: number })[];
    };
  };
  por_origen: { origen: string; registros: number; pagos: number }[];
}

export interface AdminUsuarioFila {
  id: number;
  username: string;
  nombre: string;
  email: string;
  email_duplicado: boolean;
  is_superuser: boolean;
  es_interna: boolean;
  exenta: boolean;
  date_joined: string;
  last_login: string | null;
  ultima_actividad: string | null;
  origen: string;
  pacientes_count: number;
  sesiones_mes: number;
  audio_minutos_total: number;
  tokens_ia_total: number;
  costo_ia_total_usd: number;
  suscripcion: {
    estado: string;
    estado_visible: string;
    plan: string;
    fin_prueba: string | null;
    dias_restantes_prueba: number | null;
    proximo_cobro: string | null;
    card_brand: string;
    card_last_four: string;
    monto_mensual_clp: number;
  };
}

export interface AdminUsuariosPage {
  count: number;
  page: number;
  pages: number;
  results: AdminUsuarioFila[];
}

export interface AdminUsuarioDetalle {
  cuenta: AdminUsuarioFila;
  historial_suscripcion: {
    creada_en: string | null;
    actualizada_en: string | null;
    cancelada_en: string | null;
    inactiva_desde: string | null;
    estado: string | null;
    plan: string | null;
    nota: string;
  };
  pagos_mercadopago: {
    tiene_preapproval: boolean;
    tarjeta_marca: string;
    tarjeta_ultimos4: string;
    proximo_cobro: string | null;
    plus_vinculados: { preapproval_id: string; estado_mp: string; vinculado_en: string | null; creado_en: string | null }[];
    nota: string;
  };
  uso_por_mes: {
    mes: string;
    pacientes: number;
    sesiones: number;
    minutos_audio: number;
    transcripciones_ok: number;
    transcripciones_fallidas: number;
    mensajes_chat: number;
    informes: number;
    tests: number;
    agenda: number;
    boletas: number;
  }[];
  costo_ia: {
    por_servicio_modelo: { servicio: string; modelo: string; tokens: number; costo_usd: number; registros: number }[];
    total_usd: number;
    mes_actual_usd: number;
    pago_mensual_clp: number;
    margen_nota: string;
  };
  hitos: {
    primer_paciente: string | null;
    primera_sesion: string | null;
    primera_transcripcion: string | null;
    primera_boleta: string | null;
  };
}

export interface AdminIngresos {
  mrr_clp: number;
  mrr_por_plan: Record<string, { nombre: string; cuentas: number; mrr_clp: number }>;
  pagos_del_mes: { cuentas: number; monto_clp: number; nota: string };
  serie_mensual: { mes: string; altas_aun_activas: number; cancelaciones: number; mrr_vigente_clp: number | null }[];
  mrr_nota: string;
  proximos_cobros: (AdminPersona & { plan: string; monto_clp: number; proximo_cobro: string | null })[];
  fallidos: (AdminPersona & { plan: string; inactiva_desde: string | null })[];
  cancelaciones: (AdminPersona & { plan: string; cancelada_en: string | null })[];
  por_origen: { origen: string; pagos: number; mrr_clp: number }[];
}

export interface AdminUso {
  por_servicio_mes: { mes: string; servicio: string; costo_usd: number; tokens: number }[];
  top_usuarios: (AdminPersona & { costo_usd: number; tokens: number })[];
}

export interface AdminEmbudo {
  cohortes: {
    semana: string;
    registros: number;
    primer_paciente: number;
    primera_sesion: number;
    pago: number;
    pct_paciente: number;
    pct_sesion: number;
    pct_pago: number;
  }[];
  por_origen: { origen: string; registros: number; pagos: number }[];
}
