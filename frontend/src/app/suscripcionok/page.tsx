import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, ArrowRight, Check, Sparkles, ShieldCheck } from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { ROUTES, SITE } from "@/lib/config"

export const metadata: Metadata = {
  title: "Suscripción confirmada · Psiconex",
  description: "¡Gracias por suscribirte al Plan Estándar de Psiconex! Tu cuenta ha sido activada con éxito.",
  robots: {
    index: false,
    follow: false,
  },
}

const INCLUDED_FEATURES = [
  "Sesiones clínicas ilimitadas con procesamiento seguro",
  "Transcripción y reconocimiento de voces (diarización)",
  "Fichas clínicas, notas de evolución e informes automáticos",
  "Agenda con sincronización bidireccional en Google Calendar",
  "Tests psicológicos integrados (PHQ-9, GAD-7 y más)",
  "Enlace privado y personalizado para reserva de pacientes",
]

export default function SubscriptionSuccessPage() {
  return (
    <>
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Inicio Psiconex"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:py-20">
        <div className="w-full max-w-2xl text-center">
          {/* Badge & Success Icon */}
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/10 mb-6 animate-in zoom-in-50 duration-500">
            <CheckCircle2 className="h-12 w-12" />
          </div>

          <p className="text-sm font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400">
            ¡Pago confirmado con éxito!
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            ¡Gracias por suscribirte a Psiconex!
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Tu suscripción al <strong className="text-foreground font-semibold">Plan Estándar</strong> se ha procesado correctamente. Ya tienes acceso inmediato a todas las herramientas de asistencia clínica e inteligencia artificial diseñadas para devolverle tiempo a tu consulta.
          </p>

          {/* Card Resumen del Plan */}
          <div className="mt-8 rounded-2xl border border-border/80 bg-card/60 p-6 sm:p-8 backdrop-blur-md shadow-sm text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Suscripción activa</span>
                </div>
                <h2 className="text-xl font-semibold text-foreground">Plan Estándar</h2>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl font-bold text-foreground">$4.990</span>
                <span className="text-xs text-muted-foreground ml-1">CLP / mes</span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                Beneficios incluidos en tu plan:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                {INCLUDED_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <span className="rounded-full bg-emerald-500/10 p-0.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-tight text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 pt-5 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>
                Datos clínicos cifrados y resguardados con estrictos estándares de confidencialidad médica.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto h-12 px-7 text-base font-semibold shadow-lg shadow-primary/20">
              <Link href={ROUTES.login} className="inline-flex items-center justify-center gap-2">
                <span>Ir a mi cuenta / Iniciar sesión</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-12 px-6 text-base">
              <Link href="/">Volver a la página principal</Link>
            </Button>
          </div>

          {/* Help & Support Note */}
          <p className="mt-8 text-sm text-muted-foreground max-w-md mx-auto">
            ¿Tienes alguna consulta o necesitas ayuda para configurar tu cuenta? Escríbenos a{" "}
            <a
              href={`mailto:${SITE.email}`}
              className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
            >
              {SITE.email}
            </a>
            .
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}
