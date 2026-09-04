"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, getCurrentUser } from "@/lib/api";
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock,
  LogOut,
  Mic,
  UserCog,
  UserPlus,
  Users,
  Settings,
  CreditCard,
  MessageSquarePlus,
} from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import BottomNav from "@/components/layout/bottom-nav";
import MoreDrawer from "@/components/layout/more-drawer";
import FloatingFeedbackButton from "@/components/feedback/FloatingFeedbackButton";
import { useIsMobile } from "@/hooks/use-media-query";
import { AudioRecordingProvider } from "@/context/AudioRecordingContext";
import PersistentRecordingBar from "@/components/recording/PersistentRecordingBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [suscripcionEstado, setSuscripcionEstado] = useState<string | null>(null);
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function verifySession() {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }

      try {
        const user = await getCurrentUser();
        setIsAdmin(user.username === "Admin" || user.is_admin === true);
        setIsSuperuser(user.is_superuser === true);
        setSuscripcionEstado(user.suscripcion_estado || null);
        setDiasRestantes(
          typeof user.dias_restantes_prueba === "number"
            ? user.dias_restantes_prueba
            : null
        );
        setReady(true);
      } catch {
        localStorage.clear();
        router.replace("/login");
      }
    }

    verifySession();
  }, [router, pathname]);

  // Close drawer when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (!ready) return null;

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/pacientes");
    }
    return pathname.startsWith(path);
  };

  const NavItem = ({
    href,
    icon: Icon,
    label,
  }: {
    href: string;
    icon: React.ElementType;
    label: string;
  }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={isCollapsed ? label : undefined}
        className={`group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all ${
          isCollapsed ? "justify-center px-0 mx-2" : "px-3"
        } ${
          active
            ? "bg-sidebar-primary/10 text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 transition-colors ${
            active
              ? "text-sidebar-primary"
              : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
          }`}
        />
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
    if (pathname.startsWith("/dashboard/configuracion")) return "Configuración";
    if (pathname.startsWith("/dashboard/feedback")) return "Feedback y Ayuda";
    return "";
  };

  const showAdminSection = isAdmin || isSuperuser;

  return (
    <AudioRecordingProvider>
      <div className="flex min-h-screen w-full bg-background">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden md:flex flex-col border-r border-sidebar-border bg-sidebar py-6 shadow-xl transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64 px-4"
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-7 z-50 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-all hover:scale-110 hover:bg-primary/90"
        >
          <ChevronLeft
            className={`h-5 w-5 transition-transform duration-300 ${
              isCollapsed ? "rotate-180" : ""
            }`}
          />
        </button>

        <div className={`mb-8 flex items-center gap-2 ${isCollapsed ? "justify-center px-0" : "px-2"}`}>
          <Link href="/dashboard" className="flex h-8 items-center justify-center" aria-label="Ir al dashboard">
            {isCollapsed ? (
              <Image
                src="/logo-psiconex-icon.png"
                alt="Psiconex"
                width={281}
                height={282}
                className="h-8 w-8 object-contain"
                priority
              />
            ) : (
              <Image
                src="/logo-psiconex.png"
                alt="Psiconex"
                width={1951}
                height={393}
                className="h-full w-auto object-contain drop-shadow-md"
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
          <NavItem
            href="/dashboard/suscripcion"
            icon={CreditCard}
            label="Mi Suscripción"
          />
          <NavItem href="/dashboard/configuracion/perfil" icon={Settings} label="Mi perfil" />
          <NavItem href="/dashboard/feedback" icon={MessageSquarePlus} label="Feedback y Ayuda" />
          {showAdminSection && (
            <div className="mt-8">
              {!isCollapsed && (
                <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  Administración
                </div>
              )}
              {isCollapsed && <div className="mb-2 h-px w-full bg-sidebar-border" />}
              {isAdmin && (
                <NavItem href="/dashboard/usuarios/crear" icon={UserPlus} label="Crear Usuario" />
              )}
              {isSuperuser && (
                <NavItem href="/dashboard/usuarios" icon={UserCog} label="Usuarios" />
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          isMobile ? "pl-0" : isCollapsed ? "pl-20" : "pl-64"
        }`}
      >
        {/* ── Header ── */}
        <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center justify-between border-b bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Mobile: logo + title */}
          <div className="flex items-center gap-3">
            <div className="flex md:hidden h-7 w-7 items-center justify-center">
              <Image
                src="/logo-psiconex-icon.png"
                alt="Psiconex"
                width={281}
                height={282}
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/80">
              {getSectionTitle()}
            </div>
            {suscripcionEstado === "trial" && diasRestantes !== null && (
              <Link
                href="/dashboard/suscripcion"
                className="flex md:hidden items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                <Clock className="h-3 w-3" />
                <span>{diasRestantes}d prueba</span>
              </Link>
            )}
          </div>

          {/* Desktop: trial badge + theme toggle + logout */}
          <div className="hidden md:flex items-center gap-4">
            {suscripcionEstado === "trial" && diasRestantes !== null && (
              <Link
                href="/dashboard/suscripcion"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                title="Ver detalles de tu suscripción"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Prueba activa: {diasRestantes}{" "}
                  {diasRestantes === 1 ? "día restante" : "días restantes"}
                </span>
              </Link>
            )}
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

        <main
          className={`mx-auto w-full flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8 ${
            pathname === "/dashboard/agenda" ? "max-w-[1600px]" : "max-w-6xl"
          } animate-fade-in-up`}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <>
          <BottomNav onMoreClick={() => setMoreOpen(true)} />
          <MoreDrawer
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            isAdmin={isAdmin}
            isSuperuser={isSuperuser}
          />
        </>
      )}

      {/* ── Botón Flotante Global de Feedback y Ayuda ── */}
      <FloatingFeedbackButton />

      {/* ── Barra Flotante Global de Grabación Persistente ── */}
      <PersistentRecordingBar />
    </div>
    </AudioRecordingProvider>
  );
}
