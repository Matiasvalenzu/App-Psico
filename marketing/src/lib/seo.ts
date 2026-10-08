export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Psiconex — La IA que devuelve tiempo a tu consulta",
}

// Next reemplaza (no fusiona) openGraph cuando una página define el suyo,
// así que cada página que lo sobrescriba debe repetir estos campos base.
export const BASE_OPEN_GRAPH = {
  type: "website" as const,
  locale: "es_CL",
  siteName: "Psiconex",
  images: [OG_IMAGE],
}
