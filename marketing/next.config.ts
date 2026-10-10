import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const metaPixel = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim());

const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${metaPixel ? " https://connect.facebook.net" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${metaPixel ? " https://www.facebook.com" : ""}`,
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self' https://app.psiconex.cl${metaPixel ? " https://www.facebook.com https://connect.facebook.net" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://app.psiconex.cl",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.1.151"],
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
      { source: "/og-image.png", headers: assetCache },
    ];
  },
};

export default nextConfig;
