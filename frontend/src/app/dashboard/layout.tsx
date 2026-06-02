"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getCurrentUser } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function verifySession() {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }

      try {
        const user = await getCurrentUser();
        setIsAdmin(user.username === "Admin" || user.is_admin === true);
        setReady(true);
      } catch {
        localStorage.clear();
        router.replace("/login");
      }
    }

    verifySession();
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-6 gap-4">
          <a href="/dashboard" className="font-semibold text-sm">
            Asistente Psicológico
          </a>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground ml-6">
            <a href="/dashboard" className="hover:text-foreground transition-colors">
              Pacientes
            </a>
            <a href="/dashboard/voz" className="hover:text-foreground transition-colors">
              Voz
            </a>
            {isAdmin && (
              <a href="/dashboard/usuarios/crear" className="hover:text-foreground transition-colors">
                Crear Usuario
              </a>
            )}
          </nav>
          <div className="ml-auto">
            <button
              onClick={() => {
                localStorage.clear();
                router.replace("/login");
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
