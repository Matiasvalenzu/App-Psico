export const TUTORIAL_SLUGS = [
  "bienvenida",
  "perfil",
  "boletas-config",
  "pacientes",
  "ficha",
  "consentimiento",
  "cobros",
  "sesion-presencial",
  "sesion-virtual",
  "tests",
  "agenda",
  "voz",
  "privacidad",
  "feedback",
] as const;

export type TutorialSlug = (typeof TUTORIAL_SLUGS)[number];

export interface TutorialVideo {
  slug: TutorialSlug;
  titulo: string;
  descripcion: string;
  archivo: string;
}

export const TUTORIALES: TutorialVideo[] = [
  {
    slug: "bienvenida",
    titulo: "Te damos la bienvenida a Psiconex",
    descripcion: "Un minuto para ver qué puedes hacer en la ficha, la agenda, los tests y la voz.",
    archivo: "/videos/tutoriales/bienvenida.mp4",
  },
  {
    slug: "perfil",
    titulo: "Completa tu perfil profesional",
    descripcion: "Datos de contacto, registro profesional y preferencias de atención.",
    archivo: "/videos/tutoriales/perfil.mp4",
  },
  {
    slug: "boletas-config",
    titulo: "Configura tus boletas de honorarios",
    descripcion: "Deja lista la emisión de boletas de honorarios para el SII.",
    archivo: "/videos/tutoriales/boletas-config.mp4",
  },
  {
    slug: "pacientes",
    titulo: "Crea y gestiona pacientes",
    descripcion: "Crea expedientes, filtra y abre la ficha de cada paciente.",
    archivo: "/videos/tutoriales/pacientes.mp4",
  },
  {
    slug: "ficha",
    titulo: "La ficha del paciente",
    descripcion: "Sesiones, documentos y el asistente, en la ficha de un paciente.",
    archivo: "/videos/tutoriales/ficha.mp4",
  },
  {
    slug: "consentimiento",
    titulo: "Consentimiento informado",
    descripcion: "Envía o registra el consentimiento informado desde la ficha.",
    archivo: "/videos/tutoriales/consentimiento.mp4",
  },
  {
    slug: "cobros",
    titulo: "Cobros y boletas por sesión",
    descripcion: "Registra el pago de la sesión y prepara la boleta.",
    archivo: "/videos/tutoriales/cobros.mp4",
  },
  {
    slug: "sesion-presencial",
    titulo: "Sesión presencial",
    descripcion: "Graba una sesión presencial y revisa la transcripción.",
    archivo: "/videos/tutoriales/sesion-presencial.mp4",
  },
  {
    slug: "sesion-virtual",
    titulo: "Sesión virtual Psiconex",
    descripcion: "Inicia una sesión remota y usa la sala de Psiconex.",
    archivo: "/videos/tutoriales/sesion-virtual.mp4",
  },
  {
    slug: "tests",
    titulo: "Tests psicológicos",
    descripcion: "Aplica evaluaciones como la Rueda de la Vida o el Test de Ellis.",
    archivo: "/videos/tutoriales/tests.mp4",
  },
  {
    slug: "agenda",
    titulo: "Agenda",
    descripcion: "Organiza citas, comparte tu enlace público y conecta Google Calendar.",
    archivo: "/videos/tutoriales/agenda.mp4",
  },
  {
    slug: "voz",
    titulo: "Perfil de voz",
    descripcion: "Registra tu voz para que Deepgram la distinga de la del paciente.",
    archivo: "/videos/tutoriales/voz.mp4",
  },
  {
    slug: "privacidad",
    titulo: "Privacidad y datos",
    descripcion: "Exporta o elimina tus datos y revisa los accesos.",
    archivo: "/videos/tutoriales/privacidad.mp4",
  },
  {
    slug: "feedback",
    titulo: "Feedback y Ayuda",
    descripcion: "Envía comentarios o pide ayuda desde esta sección.",
    archivo: "/videos/tutoriales/feedback.mp4",
  },
];

const POR_SLUG = new Map(TUTORIALES.map((video) => [video.slug, video]));

export function esTutorialSlug(value: string): value is TutorialSlug {
  return POR_SLUG.has(value as TutorialSlug);
}

export function tutorialPorSlug(slug: string | null | undefined): TutorialVideo | undefined {
  if (!slug) return undefined;
  return POR_SLUG.get(slug as TutorialSlug);
}

function normalizarRuta(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function tutorialForPath(pathname: string): TutorialSlug | null {
  const path = normalizarRuta(pathname);
  if (/^\/dashboard\/pacientes\/[^/]+\/sesiones\/[^/]+\/sala$/.test(path)) return "sesion-virtual";
  if (/^\/dashboard\/pacientes\/[^/]+\/sesiones\/[^/]+$/.test(path)) return null;
  if (/^\/dashboard\/pacientes\/[^/]+$/.test(path)) return "ficha";
  if (path === "/dashboard" || path === "/dashboard/pacientes") return "pacientes";
  if (path.startsWith("/dashboard/configuracion/perfil")) return "perfil";
  if (path.startsWith("/dashboard/configuracion/boletas")) return "boletas-config";
  if (path.startsWith("/dashboard/configuracion/privacidad")) return "privacidad";
  if (path.startsWith("/dashboard/tests")) return "tests";
  if (path.startsWith("/dashboard/agenda")) return "agenda";
  if (path.startsWith("/dashboard/voz")) return "voz";
  if (path.startsWith("/dashboard/feedback")) return "feedback";
  return null;
}
