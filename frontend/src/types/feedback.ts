export type FeedbackTipo = 'error' | 'mejora' | 'felicitacion' | 'consulta';

export type FeedbackModulo =
  | 'general'
  | 'pacientes'
  | 'sesiones'
  | 'agenda'
  | 'tests'
  | 'facturacion'
  | 'suscripcion'
  | 'perfil';

export type FeedbackSeveridad = 'baja' | 'media' | 'alta' | 'critica';

export type FeedbackEstado = 'nuevo' | 'en_revision' | 'resuelto' | 'descartado';

export interface FeedbackReport {
  id: number;
  tipo: FeedbackTipo;
  tipo_display: string;
  modulo: FeedbackModulo;
  modulo_display: string;
  severidad: FeedbackSeveridad;
  severidad_display: string;
  titulo: string;
  descripcion: string;
  pasos_reproducir?: string;
  impacto_mejora?: string;
  archivo_adjunto?: string | null;
  url_origen?: string;
  user_agent?: string;
  resolucion_pantalla?: string;
  estado: FeedbackEstado;
  estado_display: string;
  respuesta_admin?: string;
  usuario_id?: number;
  usuario_nombre?: string;
  usuario_email?: string;
  usuario_username?: string;
  respondido_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
  resuelto_at?: string | null;
}

export interface FeedbackStats {
  total: number;
  nuevos: number;
  en_revision: number;
  resueltos: number;
  errores: number;
  errores_abiertos: number;
  mejoras: number;
  felicitaciones: number;
}
