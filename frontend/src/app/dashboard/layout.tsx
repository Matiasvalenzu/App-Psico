"use client";

import { useEffect, useState } from "react";
import { Inter } from "next/font/google";
import { Toaster, toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, getCurrentUser } from "@/lib/api";
import { leerPreapprovalPendiente, vincularPreapproval } from "@/lib/vincularPlus";
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock,
  LogOut,
  Moon,
  Sun,
  Mic,
  UserCog,
  UserPlus,
  Users,
  Settings,
  ShieldCheck,
  Lock,
  Receipt,
  CreditCard,
  MessageSquarePlus,
  PlayCircle,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "@/components/ThemeProvider";
import Link from "next/link";
import UpsellPlusModal from "@/components/suscripcion/UpsellPlusModal";
import BottomNav from "@/components/layout/bottom-nav";
import MoreDrawer from "@/components/layout/more-drawer";
import FloatingFeedbackButton from "@/components/feedback/FloatingFeedbackButton";
import { useIsMobile } from "@/hooks/use-media-query";
import { AudioRecordingProvider } from "@/context/AudioRecordingContext";
import PersistentRecordingBar from "@/components/recording/PersistentRecordingBar";
import { TutorialProvider, useTutorial } from "@/context/TutorialContext";
import TutorialModal from "@/components/tutorial/TutorialModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Inter solo en el dashboard (la landing conserva su tipografía)
const inter = Inter({ subsets: ["latin"], display: "swap" });

function isActivePath(pathname: string, path: string) {
  if (path === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/pacientes");
  }
  return pathname.startsWith(path);
}

function NavItem({
  href,
  icon: Icon,
  label,
  pathname,
  isCollapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  pathname: string;
  isCollapsed: boolean;
}) {
  const active = isActivePath(pathname, href);
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors duration-200 ${
        isCollapsed ? "justify-center px-0 mx-2" : "px-3.5"
      } ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
      }`}
    >
      <Icon
        className={`h-4.5 w-4.5 shrink-0 ${
          active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
        }`}
      />
      {!isCollapsed && <span className="tracking-tight">{label}</span>}
    </Link>
  );
}

function NavGroup({
  label,
  isCollapsed,
  children,
}: {
  label: string;
  isCollapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {isCollapsed ? (
        <div className="mx-4 my-2 h-px bg-border/60" />
      ) : (
        <div className="mb-1 mt-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background" aria-busy="true" aria-label="Cargando">
      <div className="hidden w-64 flex-col gap-3 border-r border-border/70 bg-card/95 p-6 md:flex">
        <Skeleton className="mb-6 h-8 w-36" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center border-b border-border/70 bg-card/75 px-6 md:h-16">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6 lg:p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TutorialProvider>
      <AudioRecordingProvider>
        <div className={inter.className}>
          <DashboardInner>{children}</DashboardInner>
        </div>
        <TutorialModal />
        {/* Debajo del header (h-14 / md:h-16) para no tapar la etiqueta de la prueba. */}
        <Toaster
          richColors
          closeButton
          position="top-right"
          offset={{ top: 76 }}
          mobileOffset={{ top: 64 }}
          className={inter.className}
        />
      </AudioRecordingProvider>
    </TutorialProvider>
  );
}

function DashboardInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { openTutorial } = useTutorial();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [suscripcionEstado, setSuscripcionEstado] = useState<string | null>(null);
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [fechaPurga, setFechaPurga] = useState<string | null>(null);
  const [plusDisponible, setPlusUrl] = useState(false);
  const [boletasHabilitadas, setBoletasHabilitadas] = useState(false);
  const [upsellBoletas, setUpsellBoletas] = useState(false);
  const [usuario, setUsuario] = useState<{ nombre: string; email: string } | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();

  // Los diálogos se montan en un portal en <body>: aplicar Inter también ahí mientras el dashboard esté montado
  useEffect(() => {
    document.body.classList.add(inter.className);
    return () => document.body.classList.remove(inter.className);
  }, []);

  useEffect(() => {
    let activo = true;
    async function verifySession() {
      if (!getAccessToken()) {
        if (activo) router.replace("/login");
        return;
      }

      try {
        // Pagó Plus por el enlace sin sesión iniciada: se activa en cuanto entra.
        const pendiente = leerPreapprovalPendiente();
        if (pendiente) {
          const mensaje = await vincularPreapproval(pendiente);
          if (!activo) return;
          if (mensaje) toast.error(mensaje);
          else toast.success("El Plan Plus quedó activo en tu cuenta.");
        }

        const user = await getCurrentUser();
        if (!activo) return;
        const isAdm = user.username === "Admin" || user.is_admin === true;
        const isSuper = user.is_superuser === true;
        setIsAdmin(isAdm);
        setIsSuperuser(isSuper);
        setUsuario({
          nombre: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username,
          email: user.email || "",
        });
        setSuscripcionEstado(user.suscripcion_estado || null);
        setDiasRestantes(
          typeof user.dias_restantes_prueba === "number"
            ? user.dias_restantes_prueba
            : null
        );

        // Suscripción inactiva: la cuenta queda en solo lectura (el backend bloquea escrituras)
        setFechaPurga(user.solo_lectura ? user.fecha_purga || null : null);
        setPlusUrl(Boolean(user.plan_plus_disponible));
        setBoletasHabilitadas(Boolean(user.boletas_habilitadas));

        setReady(true);
      } catch {
        if (activo && !getAccessToken()) router.replace("/login");
      }
    }

    verifySession();
    return () => {
      activo = false;
    };
  }, [router, pathname]);

  // Close drawer when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Solo la primera verificación bloquea; las siguientes (por cambio de ruta) corren en segundo plano
  if (!ready) return <ShellSkeleton />;

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

  const navProps = { pathname, isCollapsed };

  return (
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
              <>
                <Image
                  src="/logo-psiconex.png"
                  alt="Psiconex"
                  width={1200}
                  height={273}
                  className="h-full w-auto object-contain drop-shadow-sm dark:hidden"
                  priority
                />
                <Image
                  src="/logo-psiconex-dark.png"
                  alt="Psiconex"
                  width={1200}
                  height={273}
                  className="hidden h-full w-auto object-contain dark:block"
                  priority
                />
              </>
            )}
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto" aria-label="Navegación principal">
          <NavGroup label="Clínica" isCollapsed={isCollapsed}>
            <NavItem href="/dashboard" icon={Users} label="Pacientes" {...navProps} />
            <NavItem href="/dashboard/agenda" icon={CalendarDays} label="Agenda" {...navProps} />
            <NavItem href="/dashboard/tests" icon={ClipboardList} label="Tests" {...navProps} />
            <NavItem href="/dashboard/voz" icon={Mic} label="Voz" {...navProps} />
          </NavGroup>
          <NavGroup label="Cuenta" isCollapsed={isCollapsed}>
            <NavItem href="/dashboard/suscripcion" icon={CreditCard} label="Mi Suscripción" {...navProps} />
            {boletasHabilitadas ? (
              <NavItem href="/dashboard/configuracion/boletas" icon={Receipt} label="Boletas de honorarios" {...navProps} />
            ) : (
              <button
                type="button"
                onClick={() => setUpsellBoletas(true)}
                title={isCollapsed ? "Boletas de honorarios" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/80 hover:text-foreground ${
                  isCollapsed ? "justify-center px-0 mx-2" : "px-3.5"
                }`}
              >
                <Receipt className="h-4.5 w-4.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground" />
                {!isCollapsed && (
                  <span className="flex items-center gap-2 tracking-tight">
                    Boletas de honorarios
                    <Lock className="h-3.5 w-3.5" />
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">Plus</span>
                  </span>
                )}
              </button>
            )}
            <NavItem href="/dashboard/configuracion/perfil" icon={Settings} label="Mi perfil" {...navProps} />
            <NavItem href="/dashboard/configuracion/privacidad" icon={ShieldCheck} label="Privacidad y datos" {...navProps} />
            {isAdmin && (
              <NavItem href="/dashboard/usuarios/crear" icon={UserPlus} label="Crear Usuario" {...navProps} />
            )}
            {isSuperuser && (
              <NavItem href="/dashboard/usuarios" icon={UserCog} label="Usuarios" {...navProps} />
            )}
          </NavGroup>
          <NavGroup label="Ayuda" isCollapsed={isCollapsed}>
            <NavItem href="/dashboard/feedback" icon={MessageSquarePlus} label="Feedback y Ayuda" {...navProps} />
            <button
              type="button"
              onClick={() => openTutorial(0)}
              title={isCollapsed ? "Video Tutorial" : undefined}
              className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors duration-200 text-muted-foreground hover:bg-accent/80 hover:text-foreground ${
                isCollapsed ? "justify-center px-0 mx-2" : "px-3.5"
              }`}
            >
              <Video className="h-4.5 w-4.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground" />
              {!isCollapsed && <span className="tracking-tight">Video Tutorial</span>}
            </button>
          </NavGroup>
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          isMobile ? "pl-0" : isCollapsed ? "pl-20" : "pl-64"
        }`}
      >
        {/* ── Header ── */}
        <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center justify-between gap-2 border-b border-border/70 bg-card/75 px-4 md:px-6 backdrop-blur-md">
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
            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden lg:inline-block text-xs font-medium text-muted-foreground/60">Psiconex</span>
              <span className="hidden lg:inline-block text-xs text-muted-foreground/40">/</span>
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                {getSectionTitle()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openTutorial(0)}
              className="flex md:hidden items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
              title="Ver tutorial guiado"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tutorial</span>
            </button>
          </div>

          {/* Prueba (todas las resoluciones) + tutorial y menú de usuario (desktop) */}
          <div className="flex items-center gap-2 md:gap-3">
            {suscripcionEstado === "trial" && diasRestantes !== null && (
              <Link
                href="/dashboard/suscripcion"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 md:gap-2 md:px-3.5 md:py-1 dark:text-amber-300"
                title="Ver detalles de tu suscripción"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="whitespace-nowrap lg:hidden">{diasRestantes}d</span>
                <span className="hidden whitespace-nowrap lg:inline">
                  Prueba activa: <strong className="font-bold">{diasRestantes}</strong>{" "}
                  {diasRestantes === 1 ? "día restante" : "días restantes"}
                </span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => openTutorial(0)}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-accent hover:border-primary/40"
              title="Ver video tutorial de Psiconex (11 min)"
            >
              <PlayCircle className="h-4 w-4 text-primary" />
              <span className="hidden lg:inline">Tutorial</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Menú de usuario"
              >
                {(usuario?.nombre || "?").charAt(0).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {usuario && (
                  <>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-sm font-medium">{usuario.nombre}</p>
                      {usuario.email && <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => router.push("/dashboard/configuracion/perfil")}>
                  <Settings />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard/configuracion/privacidad")}>
                  <ShieldCheck />
                  Privacidad y datos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard/suscripcion")}>
                  <CreditCard />
                  Mi suscripción
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "dark" ? <Sun /> : <Moon />}
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    localStorage.clear();
                    router.replace("/login");
                  }}
                >
                  <LogOut />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {fechaPurga && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Solo lectura</strong> · tu suscripción no está activa. Tus datos se eliminarán el{" "}
              <strong className="font-semibold">
                {new Date(fechaPurga).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              </strong>
              .
            </span>
            <span className="flex items-center gap-3 font-semibold">
              <Link href="/dashboard/configuracion/privacidad" className="underline underline-offset-2 hover:no-underline">
                Exportar mis datos
              </Link>
              <Link href="/dashboard/suscripcion" className="underline underline-offset-2 hover:no-underline">
                Reactivar plan
              </Link>
              {plusDisponible && (
                <Link href="/dashboard/suscripcion?activar=plus" className="underline underline-offset-2 hover:no-underline">
                  Suscribirme a Plus
                </Link>
              )}
            </span>
          </div>
        )}

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
            boletasHabilitadas={boletasHabilitadas}
            onBoletasPlus={() => setUpsellBoletas(true)}
          />
        </>
      )}

      {/* ── Botón Flotante Global de Feedback y Ayuda ── */}
      <FloatingFeedbackButton />

      {/* ── Barra Flotante Global de Grabación Persistente ── */}
      <PersistentRecordingBar />
      <UpsellPlusModal
        open={upsellBoletas}
        onOpenChange={setUpsellBoletas}
        origen="menu"
        enPrueba={suscripcionEstado === "trial"}
      />
    </div>
  );
}
