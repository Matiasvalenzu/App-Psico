"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Moon,
  Sun,
  UserCog,
  UserPlus,
  CreditCard,
  X,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface MoreDrawerProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isSuperuser: boolean;
}

export default function MoreDrawer({
  open,
  onClose,
  isAdmin,
  isSuperuser,
}: MoreDrawerProps) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/login");
  };

  const showAdminSection = isAdmin || isSuperuser;

  const MenuItem = ({
    href,
    icon: Icon,
    label,
    onClick,
    variant,
  }: {
    href?: string;
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: "destructive";
  }) => {
    const content = (
      <>
        <Icon
          className={`h-5 w-5 shrink-0 ${
            variant === "destructive"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        />
        <span
          className={
            variant === "destructive"
              ? "text-destructive"
              : "text-foreground"
          }
        >
          {label}
        </span>
      </>
    );

    if (href) {
      return (
        <Link
          href={href}
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:bg-accent"
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        onClick={() => {
          onClick?.();
          onClose();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:bg-accent"
      >
        {content}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Más opciones"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-semibold text-foreground">
            Más opciones
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="space-y-0.5">
            <MenuItem
              href="/dashboard/configuracion/perfil"
              icon={UserCog}
              label="Mi perfil"
            />

            {showAdminSection && (
              <>
                <div className="my-2 h-px bg-border mx-2" />
                <div className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Administración
                </div>
                {isAdmin && (
                  <MenuItem
                    href="/dashboard/usuarios/crear"
                    icon={UserPlus}
                    label="Crear Usuario"
                  />
                )}
                {isSuperuser && (
                  <MenuItem
                    href="/dashboard/usuarios"
                    icon={UserCog}
                    label="Usuarios"
                  />
                )}
              </>
            )}

            <div className="my-2 h-px bg-border mx-2" />

            <MenuItem
              href="/dashboard/suscripcion"
              icon={CreditCard}
              label="Mi Suscripción"
            />

            <MenuItem
              icon={theme === "dark" ? Sun : Moon}
              label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              onClick={toggle}
            />

            <div className="my-2 h-px bg-border mx-2" />

            <MenuItem
              icon={LogOut}
              label="Cerrar sesión"
              onClick={handleLogout}
              variant="destructive"
            />
          </div>
        </div>
      </div>
    </>
  );
}
