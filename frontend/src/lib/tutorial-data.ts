export interface TutorialCapitulo {
  modulo: number;
  titulo: string;
  descripcion: string;
  timestamp: string;
  segundosInicio: number;
  duracionSegundos: number;
  pantallaAsociada: string;
  icono?: string;
}

export const TUTORIAL_METADATA = {
  titulo: "Psiconex - Tutorial Maestro Completo",
  duracionTotalSegundos: 676.34,
  duracionTotalFormateada: "11:16",
  videoUrl: "/videos/Psiconex_Tutorial_Completo.mp4",
};

export const TUTORIAL_CAPITULOS: TutorialCapitulo[] = [
  {
    modulo: 0,
    titulo: "Bienvenida e Introducción a Psiconex",
    descripcion: "Conoce la plataforma Psiconex y cómo optimizar tu práctica clínica con IA.",
    timestamp: "00:00",
    segundosInicio: 0.0,
    duracionSegundos: 17.09,
    pantallaAsociada: "Onboarding inicial",
  },
  {
    modulo: 1,
    titulo: "Configuración de Perfil Profesional",
    descripcion: "Configura tus datos de contacto, registro profesional y preferencias de atención.",
    timestamp: "00:17",
    segundosInicio: 17.09,
    duracionSegundos: 31.09,
    pantallaAsociada: "/dashboard/configuracion/perfil",
  },
  {
    modulo: 2,
    titulo: "Registro y Gestión de Pacientes",
    descripcion: "Crea expedientes de pacientes, administra estados terapéuticos y filtros.",
    timestamp: "00:48",
    segundosInicio: 48.17,
    duracionSegundos: 63.98,
    pantallaAsociada: "/dashboard",
  },
  {
    modulo: 3,
    titulo: "Ficha Clínica y Asistente IA",
    descripcion: "Explora el expediente clínico y cómo interactuar con el copiloto IA para hipótesis clínicas.",
    timestamp: "01:52",
    segundosInicio: 112.16,
    duracionSegundos: 73.88,
    pantallaAsociada: "/dashboard/pacientes/[id]",
  },
  {
    modulo: 4,
    titulo: "Enrolamiento y Muestra de Voz",
    descripcion: "Entrena el modelo de diarización con tu voz para separar automáticamente tus intervenciones.",
    timestamp: "03:06",
    segundosInicio: 186.04,
    duracionSegundos: 124.57,
    pantallaAsociada: "/dashboard/voz",
  },
  {
    modulo: 5,
    titulo: "Registro de Sesión Presencial",
    descripcion: "Graba sesiones presenciales en vivo con diarización y notas automáticas.",
    timestamp: "05:11",
    segundosInicio: 310.61,
    duracionSegundos: 67.31,
    pantallaAsociada: "/dashboard/pacientes/[id] (Nueva Sesión)",
  },
  {
    modulo: 6,
    titulo: "Sesiones Online con Google Meet",
    descripcion: "Graba y analiza consultas remotas de Meet usando la extensión de Chrome de Psiconex.",
    timestamp: "06:18",
    segundosInicio: 377.92,
    duracionSegundos: 71.32,
    pantallaAsociada: "/dashboard/pacientes/[id] (Sesión Online)",
  },
  {
    modulo: 7,
    titulo: "Sincronización con Google Calendar",
    descripcion: "Conecta tu calendario de Google para sincronizar citas y disponibilidad en tiempo real.",
    timestamp: "07:29",
    segundosInicio: 449.24,
    duracionSegundos: 69.44,
    pantallaAsociada: "/dashboard/agenda",
  },
  {
    modulo: 8,
    titulo: "Agenda Pública y Reserva de Citas",
    descripcion: "Configura tu enlace público de reservas con verificación OTP y confirmación vía WhatsApp.",
    timestamp: "08:39",
    segundosInicio: 518.68,
    duracionSegundos: 142.03,
    pantallaAsociada: "/dashboard/agenda (Pública)",
  },
  {
    modulo: 9,
    titulo: "Cierre y Próximos Pasos",
    descripcion: "Recomendaciones finales para maximizar el provecho de todas las herramientas de Psiconex.",
    timestamp: "11:01",
    segundosInicio: 660.71,
    duracionSegundos: 15.62,
    pantallaAsociada: "Cierre del tutorial",
  },
];
