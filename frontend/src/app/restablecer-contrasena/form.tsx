"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { API_URL } from "@/lib/api";

const inputClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 dark:bg-background/50";
const submitClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_-10px_hsl(var(--primary)/0.7)] transition hover:bg-primary/90 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

export default function RestablecerContrasenaForm() {
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/confirm/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "No se pudo restablecer la contraseña.");
        return;
      }
      setDone(true);
    } catch {
      setError("No pudimos conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="theme-landing relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-16">
        <section className="w-full rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_70px_-34px_hsl(var(--primary)/0.45)] sm:p-9">
          <Image src="/logo-psiconex.png" alt="Psiconex" width={1951} height={393} className="mx-auto h-11 w-auto dark:hidden" priority />
          <Image src="/logo-psiconex-sidebar.png" alt="Psiconex" width={1951} height={393} className="mx-auto hidden h-11 w-auto dark:block" priority />
          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight">Nueva contraseña</h1>
          {!uid || !token ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              El enlace no es válido. Solicita uno nuevo desde recuperar contraseña.
            </p>
          ) : done ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Tu contraseña fue actualizada. Ya puedes iniciar sesión.</span>
              </div>
              <Link href="/login" className={submitClass}>
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                    aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm" className="block text-sm font-medium">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar contraseña
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
