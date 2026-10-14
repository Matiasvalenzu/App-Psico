// Tipos y utilidades del módulo de seguimiento clínico (escalas, brief, informes, tareas y ánimo).
export const API_SEG = "/api/seguimiento";

export type Opcion = { valor: number; texto: string };
export type Pregunta = { id: number; texto: string; subescala?: string; inversa?: boolean };
export type Corte = { desde: number; hasta: number; codigo: string; etiqueta: string };
export type Escala = {
  slug: string;
  nombre: string;
  nombre_largo: string;
  dominio: string;
  duracion_min: number;
  mayor_es_mejor: boolean;
  max: number;
  min?: number | null;
  instrucciones: string;
  opciones: Opcion[];
  preguntas: Pregunta[];
  pregunta_funcional?: { id: number; texto: string; opciones: Opcion[] } | null;
  cortes?: Corte[] | null;
  subescalas?: { clave: string; nombre: string; cortes: Corte[] }[] | null;
  referencia: string;
};
export type AlertaRiesgo = { pregunta_id: number; texto: string; valor: number; opcion: string; etiqueta: string; validada: boolean };
export type Subpuntaje = { clave: string; nombre: string; puntaje: number; severidad: string; etiqueta: string };
export type ResultadoEscala = {
  total: number | null;
  severidad: string;
  etiqueta: string;
  subescalas: Subpuntaje[];
  alertas_riesgo: AlertaRiesgo[];
  item_funcional: string | null;
};
export type Aplicacion = {
  id: number;
  escala: string;
  nombre: string;
  canal: "EN_CONSULTA" | "ENLACE" | "EMAIL";
  estado: "PENDIENTE" | "COMPLETADA" | "CANCELADA";
  vencida: boolean;
  expira_en: string | null;
  completada_en: string | null;
  created_at: string;
  puntaje_total: number | null;
  severidad: string;
  resultado: ResultadoEscala | Record<string, never>;
  respuestas: Record<string, number>;
  alerta_riesgo: boolean;
  alerta_revisada_en: string | null;
  enlace?: string;
  whatsapp_url?: string;
  mensaje?: string;
};
export type PuntoTrayectoria = {
  id: number;
  fecha: string;
  total: number | null;
  severidad: string;
  etiqueta: string;
  subescalas: Subpuntaje[];
  alerta_riesgo: boolean;
};
export type SerieTrayectoria = {
  slug: string;
  nombre: string;
  nombre_largo: string;
  max: number;
  min: number;
  mayor_es_mejor: boolean;
  cortes: Corte[] | null;
  subescalas: { clave: string; nombre: string; cortes: Corte[] }[] | null;
  puntos: PuntoTrayectoria[];
};
export type DocumentoIA = {
  id: number;
  tipo: string;
  tipo_label: string;
  estado: "PENDIENTE" | "LISTO" | "ERROR";
  destinatario: string;
  contexto_adicional: string;
  diagnostico_codigo: string;
  diagnostico_descripcion: string;
  contenido: string;
  advertencias: string[];
  error: string;
  modelo: string;
  es_borrador: boolean;
  finalizado_en: string | null;
  created_at: string;
  updated_at: string;
};
export type Tarea = {
  id: number;
  descripcion: string;
  fecha_entrega: string | null;
  sesion_fecha?: string | null;
  completada: boolean;
  completada_en?: string | null;
  completada_por?: string;
  nota_paciente: string;
  visible_para_paciente?: boolean;
  vencida: boolean;
};
export type Animo = { id: number; fecha: string; valor: number; etiqueta: string; emociones: string[]; nota: string; registrado_por: "PACIENTE" | "PSICOLOGO" };

export const COLOR_SEVERIDAD: Record<string, string> = {
  ninguna: "#10b981",
  minima: "#10b981",
  normal: "#10b981",
  elevada: "#10b981",
  leve: "#3b82f6",
  moderada: "#f59e0b",
  media: "#f59e0b",
  "moderada-grave": "#f97316",
  grave: "#ef4444",
  severa: "#ef4444",
  baja: "#ef4444",
  "extremadamente-severa": "#b91c1c",
};
export const colorSeveridad = (s?: string) => (s && COLOR_SEVERIDAD[s]) || "#6b7280";

export const TIPOS_INFORME = [
  { value: "AVANCE", label: "Informe de avance", hint: "Para el profesional derivante" },
  { value: "COLEGIO", label: "Establecimiento educacional", hint: "Lenguaje para docentes y directivos" },
  { value: "TRIBUNAL", label: "Tribunal de Familia", hint: "Formato técnico: distingue hechos, relato y apreciación" },
  { value: "LICENCIA", label: "Licencia médica", hint: "Respaldo con diagnóstico CIE-10 (requiere diagnóstico en la ficha)" },
  { value: "DERIVACION", label: "Derivación / interconsulta", hint: "Para el profesional que recibe al paciente" },
];

export function etiquetaAnimo(v: number) {
  if (v <= 2) return "Muy bajo";
  if (v <= 4) return "Bajo";
  if (v <= 6) return "Neutro";
  if (v <= 8) return "Bueno";
  return "Muy bueno";
}
export function colorAnimo(v: number) {
  const colores = ["#ef4444", "#ef4444", "#f97316", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#10b981"];
  return colores[Math.min(Math.max(v, 1), 10) - 1];
}
export function fechaCorta(iso?: string | null) {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export const LINEAS_AYUDA =
  "Si estás pasando por un momento difícil o tienes pensamientos de hacerte daño, no estás solo/a. Puedes llamar gratis las 24 horas a la Línea de Prevención del Suicidio *4141 o a Salud Responde 600 360 7777. En una emergencia, llama al 131 o acude al servicio de urgencia más cercano.";
