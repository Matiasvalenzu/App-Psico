"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, getCurrentUser } from "@/lib/api";
import { Brain, LogOut, Mic, Users } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  const isActive = (path: string) =>
    pathname === path
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground";

  return (
    <div className="min-h-screen bg-muted/40 dark:bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
          <a
            href="/dashboard"
            className="mr-4 flex items-center gap-2 font-semibold text-sm tracking-tight"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </span>
            <span className="hidden sm:inline">Asistente Psicológico</span>
          </a>

          <nav className="flex items-center gap-1 text-sm">
            <a
              href="/dashboard"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${isActive("/dashboard")}`}
            >
              <Users className="h-4 w-4" />
              Pacientes
            </a>
            <a
              href="/dashboard/voz"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${isActive("/dashboard/voz")}`}
            >
              <Mic className="h-4 w-4" />
              Voz
            </a>
            {isAdmin && (
              <a
                href="/dashboard/usuarios/crear"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-accent/50 hover:text-foreground text-muted-foreground`}
              >
                Crear Usuario
              </a>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => {
                localStorage.clear();
                router.replace("/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
