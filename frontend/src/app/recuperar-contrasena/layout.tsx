import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default function RecuperarContrasenaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
