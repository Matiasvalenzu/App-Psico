// Pasos del onboarding del primer ingreso. El estado se guarda en el perfil
// (onboarding_pasos) para armar la tarjeta "Completa tu configuración".

export type PasoOnboarding = "datos" | "voz" | "calendario" | "consulta" | "pacientes" | "boletas";
export type EstadoPaso = "hecho" | "omitido";

export const PASOS_ONBOARDING: {
  id: PasoOnboarding;
  titulo: string;
  pendiente: string;
  href: string;
}[] = [
  { id: "datos", titulo: "Tus datos", pendiente: "Completa tus datos profesionales", href: "/dashboard/configuracion/perfil" },
  { id: "voz", titulo: "Tu voz", pendiente: "Graba tu voz para distinguirte en las transcripciones", href: "/dashboard/voz" },
  { id: "calendario", titulo: "Calendario", pendiente: "Conecta tu Google Calendar", href: "/dashboard/agenda" },
  { id: "consulta", titulo: "Tu consulta", pendiente: "Indica cómo atiendes", href: "/dashboard/configuracion/perfil" },
  { id: "pacientes", titulo: "Pacientes", pendiente: "Importa tus pacientes desde Excel", href: "/dashboard" },
  { id: "boletas", titulo: "Boletas", pendiente: "Autoriza a Psiconex para emitir tus boletas", href: "/dashboard/configuracion/boletas" },
];

export const EVENTO_ONBOARDING = "psiconex:onboarding-listo";
