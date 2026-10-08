import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Psiconex — La IA que devuelve tiempo a tu consulta",
    template: "%s · Psiconex",
  },
  description:
    "Psiconex transcribe, diariza y resume tus sesiones de psicología. Informes clínicos en un minuto, no en una hora.",
  metadataBase: new URL("https://psiconex.cl"),
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "YyDPpjY540iueP7mAa30gpFJxfMEHuVeEJQRA3BDWGc",
  },
  openGraph: {
    title: "Psiconex — La IA que devuelve tiempo a tu consulta",
    description:
      "Transcripción, diarización por voz, memoria clínica inteligente, informes automáticos y tests psicológicos. Hecho para psicólogos clínicos.",
    type: "website",
    locale: "es_CL",
    siteName: "Psiconex",
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Psiconex — La IA que devuelve tiempo a tu consulta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Psiconex — La IA que devuelve tiempo a tu consulta",
    description:
      "Transcripción, diarización por voz, memoria clínica inteligente, informes automáticos y tests psicológicos. Hecho para psicólogos clínicos.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
