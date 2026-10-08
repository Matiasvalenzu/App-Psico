/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const cspReportOnly = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "https://sdk.mercadopago.com",
    "https://http2.mlstatic.com",
    "https://accounts.google.com",
    "https://apis.google.com",
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://http2.mlstatic.com https://*.mercadopago.com",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  [
    "connect-src 'self'",
    "https://app.psiconex.cl",
    "wss://app.psiconex.cl",
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://api.mercadopago.com",
    "https://api.mercadopago.cl",
    "https://sdk.mercadopago.com",
    "https://http2.mlstatic.com",
    // STUN/TURN no se rigen por CSP (y "stun:host" es una fuente inválida que genera avisos en consola).
  ].join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.mercadopago.com https://www.mercadopago.cl https://api.mercadopago.com",
  "frame-src https://accounts.google.com https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.cl",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.1.151"],
  images: {
    unoptimized: true,
  },
  async headers() {
    const assetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=604800, stale-while-revalidate=86400",
      },
    ];
    const htmlCache = [
      { key: "Cache-Control", value: "no-cache, must-revalidate" },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/", headers: htmlCache },
      {
        source: "/:path((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)",
        headers: htmlCache,
      },
      { source: "/hero-product-demo.mp4", headers: assetCache },
      { source: "/hero-product-demo-poster.jpg", headers: assetCache },
    ];
  },
};

module.exports = nextConfig;
