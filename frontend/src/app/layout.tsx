import type { Metadata, Viewport } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { GoogleAdsTag } from "@/components/analytics/google-ads-tag";
import { ConsentBanner } from "@/components/analytics/consent-banner";

export const metadata: Metadata = {
  title: "Psicólogo – Asistente de Sesiones",
  description: "Herramienta de transcripción y análisis de sesiones psicológicas",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <MetaPixel />
        <GoogleAdsTag />
        <ConsentBanner />
      </body>
    </html>
  );
}
