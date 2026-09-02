"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Mic,
  MoreHorizontal,
  Users,
} from "lucide-react";

interface BottomNavProps {
  onMoreClick: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: Users, label: "Pacientes" },
  { href: "/dashboard/voz", icon: Mic, label: "Voz" },
  { href: "/dashboard/agenda", icon: CalendarDays, label: "Agenda" },
  { href: "/dashboard/tests", icon: ClipboardList, label: "Tests" },
];

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return (
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/pacientes")
      );
    }
    return pathname.startsWith(path);
  };

  const isMoreActive =
    pathname.startsWith("/dashboard/configuracion") ||
    pathname.startsWith("/dashboard/usuarios");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-end justify-around border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2 text-[10px] font-medium transition-colors ${
              active
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${active ? "text-primary" : ""}`}
              strokeWidth={active ? 2.5 : 2}
            />
            <span>{label}</span>
          </Link>
        );
      })}

      <button
        onClick={onMoreClick}
        className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2 text-[10px] font-medium transition-colors ${
          isMoreActive
            ? "text-primary"
            : "text-muted-foreground active:text-foreground"
        }`}
      >
        <MoreHorizontal
          className={`h-5 w-5 ${isMoreActive ? "text-primary" : ""}`}
          strokeWidth={isMoreActive ? 2.5 : 2}
        />
        <span>Más</span>
      </button>
    </nav>
  );
}
