import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
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
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
