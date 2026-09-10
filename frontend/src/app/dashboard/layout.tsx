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
        const isAdm = user.username === "Admin" || user.is_admin === true;
        const isSuper = user.is_superuser === true;
        setIsAdmin(isAdm);
        setIsSuperuser(isSuper);
        setSuscripcionEstado(user.suscripcion_estado || null);
        setDiasRestantes(
          typeof user.dias_restantes_prueba === "number"
            ? user.dias_restantes_prueba
            : null
        );

        // Si la suscripción expiró y no es admin, forzar navegación a /dashboard/suscripcion
        if (!isAdm && !isSuper && user.suscripcion_activa === false) {
          if (pathname !== "/dashboard/suscripcion") {
            router.replace("/dashboard/suscripcion");
            return;
          }
        }

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
        className={`group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
          isCollapsed ? "justify-center px-0 mx-2" : "px-3.5"
        } ${
          active
            ? "bg-primary/10 text-primary font-semibold shadow-xs border border-primary/20"
            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
        }`}
      >
        <Icon
          className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
            active
              ? "text-primary"
              : "text-muted-foreground/70 group-hover:text-foreground"
          }`}
        />
        {!isCollapsed && <span className="tracking-tight">{label}</span>}
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
        className={`fixed inset-y-0 left-0 z-20 hidden md:flex flex-col border-r border-border/70 bg-card/95 py-6 backdrop-blur-md transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64 px-4"
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3.5 top-7 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-all hover:scale-110 hover:bg-accent hover:border-primary/40"
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform duration-300 ${
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
                className="h-full w-auto object-contain drop-shadow-sm"
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
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Administración
                </div>
              )}
              {isCollapsed && <div className="mb-2 h-px w-full bg-border/60" />}
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
        <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center justify-between border-b border-border/70 bg-card/75 px-4 md:px-6 backdrop-blur-md">
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
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block text-xs font-medium text-muted-foreground/60">Psiconex</span>
              <span className="hidden md:inline-block text-xs text-muted-foreground/40">/</span>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {getSectionTitle()}
              </span>
            </div>
            {suscripcionEstado === "trial" && diasRestantes !== null && (
              <Link
                href="/dashboard/suscripcion"
                className="flex md:hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>{diasRestantes}d prueba</span>
              </Link>
            )}
          </div>

          {/* Desktop: trial badge + theme toggle + logout */}
          <div className="hidden md:flex items-center gap-3.5">
            {suscripcionEstado === "trial" && diasRestantes !== null && (
              <Link
                href="/dashboard/suscripcion"
                className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/15 transition-all dark:text-amber-300 dark:border-amber-500/30"
                title="Ver detalles de tu suscripción"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>
                  Prueba activa: <strong className="font-bold">{diasRestantes}</strong>{" "}
                  {diasRestantes === 1 ? "día restante" : "días restantes"}
                </span>
              </Link>
            )}
            <div className="h-4 w-px bg-border/80" />
            <ThemeToggle />
            <div className="h-4 w-px bg-border/80" />
            <button
              onClick={() => {
                localStorage.clear();
                router.replace("/login");
              }}
              className="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
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
