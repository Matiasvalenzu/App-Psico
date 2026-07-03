"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, getCurrentUser } from "@/lib/api";
import { CalendarDays, ClipboardList, LogOut, Mic, Users, UserPlus, ChevronLeft } from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/pacientes");
    }
    return pathname.startsWith(path);
  };

  const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={isCollapsed ? label : undefined}
        className={`group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all ${isCollapsed ? "justify-center px-0 mx-2" : "px-3"} ${
          active 
            ? "bg-sidebar-primary/10 text-sidebar-primary" 
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 transition-colors ${active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"}`} />
        {!isCollapsed && <span>{label}</span>}
      </Link>
    );
  };

  const getSectionTitle = () => {
    if (pathname === "/dashboard") return "Pacientes";
    if (pathname.startsWith("/dashboard/pacientes/")) return "Detalle del Paciente";
    if (pathname.startsWith("/dashboard/voz")) return "Voz";
    if (pathname.startsWith("/dashboard/agenda")) return "Agenda";
    if (pathname.startsWith("/dashboard/tests")) return "Tests";
    if (pathname.startsWith("/dashboard/usuarios")) return "Usuarios";
    return "";
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-sidebar-border bg-sidebar py-6 shadow-xl transition-all duration-300 ${isCollapsed ? "w-20" : "w-64 px-4"}`}>
        
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-7 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-110 z-50 transition-all"
        >
          <ChevronLeft className={`h-5 w-5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} />
        </button>

        <div className={`mb-8 flex items-center gap-2 ${isCollapsed ? "justify-center px-0" : "px-2"}`}>
          <Link href="/dashboard" className="flex h-8 items-center justify-center" aria-label="Ir al dashboard">
            {isCollapsed ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg drop-shadow-md">
                P
              </span>
            ) : (
              <Image
                src="/logo-psiconex-app.png"
                alt="Psiconex"
                width={5916}
                height={1664}
                className="h-full w-auto object-contain drop-shadow-md brightness-0 invert"
                priority
              />
            )}
          </Link>
        </div>
        
        <nav className="flex flex-1 flex-col gap-1.5">
          <NavItem href="/dashboard" icon={Users} label="Pacientes" />
          <NavItem href="/dashboard/voz" icon={Mic} label="Voz" />
          <NavItem href="/dashboard/agenda" icon={CalendarDays} label="Agenda" />
          <NavItem href="/dashboard/tests" icon={ClipboardList} label="Tests" />
          
          {isAdmin && (
            <div className="mt-8">
              {!isCollapsed && (
                <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  Administración
                </div>
              )}
              {isCollapsed && <div className="mb-2 w-full h-px bg-sidebar-border" />}
              <NavItem href="/dashboard/usuarios/crear" icon={UserPlus} label="Crear Usuario" />
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${isCollapsed ? "pl-20" : "pl-64"}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="text-sm font-semibold text-muted-foreground/80 tracking-wide uppercase">
             {getSectionTitle()}
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-4 w-px bg-border" />
            <button
              onClick={() => {
                localStorage.clear();
                router.replace("/login");
              }}
              className="group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Salir
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 p-6 lg:p-8 ${pathname === "/dashboard/agenda" ? "max-w-[1600px]" : "max-w-6xl"} mx-auto w-full animate-fade-in-up`}>
          {children}
        </main>
      </div>
    </div>
  );
}
