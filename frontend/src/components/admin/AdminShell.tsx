"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/api";

const LINKS = [
  { href: "/dashboard/admin", label: "Resumen" },
  { href: "/dashboard/usuarios", label: "Usuarios" },
  { href: "/dashboard/admin/ingresos", label: "Ingresos" },
  { href: "/dashboard/admin/uso", label: "Uso e IA" },
  { href: "/dashboard/admin/embudo", label: "Embudo" },
];

export default function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user.is_superuser !== true) {
          router.replace("/dashboard");
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card p-1" aria-label="Administración">
        {LINKS.map((link) => {
          const active = link.href === "/dashboard/usuarios"
            ? pathname.startsWith("/dashboard/usuarios") || pathname.startsWith("/dashboard/admin/usuarios")
            : pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
