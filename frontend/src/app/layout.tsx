import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Psicólogo – Asistente de Sesiones",
  description: "Herramienta de transcripción y análisis de sesiones psicológicas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
