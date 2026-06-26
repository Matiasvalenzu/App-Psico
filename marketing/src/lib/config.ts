/**
 * URL pública de la app real (Django + Next.js).
 * En dev por defecto apunta a localhost:3000 (frontend de la app).
 * En producción se configura via env NEXT_PUBLIC_APP_URL.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3000"

export const ROUTES = {
  login: `${APP_URL}/login`,
  register: `${APP_URL}/login`, // la app aún no tiene /register público
  dashboard: `${APP_URL}/dashboard`,
} as const

export const SITE = {
  name: "Psiconex",
  domain: "psiconex.vercel.app",
  tagline: "La IA que devuelve tiempo a tu consulta",
  email: "hola@psiconex.app",
} as const
