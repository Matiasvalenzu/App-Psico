"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { API_URL } from "@/lib/api";

const GENERIC =
  "Si el correo está registrado, te enviaremos un enlace para restablecer tu contraseña.";

const inputClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 dark:bg-background/50";
const submitClass =
  "group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_-10px_hsl(var(--primary)/0.7)] transition hover:bg-primary/90 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch(`${API_URL}/auth/password-reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMessage(GENERIC);
    } catch {
      setError("No pudimos enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.");
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
          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            Ingresa el correo de tu cuenta. Si está registrado, te enviaremos un enlace.
          </p>
          {message ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="ejemplo@correo.com"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enviar enlace
              </button>
            </form>
          )}
          <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Volver a iniciar sesión
          </Link>
        </section>
      </main>
    </div>
  );
}
