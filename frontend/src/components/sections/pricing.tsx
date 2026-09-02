"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Check, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"
import { ROUTES } from "@/lib/config"
import { cn } from "@/lib/utils"

interface Plan {
  name: string
  price: string
  period: string
  description: string
  cta: string
  features: string[]
  featured?: boolean
  comingSoon?: boolean
}

const PLANS: Plan[] = [
  {
    name: "Estándar",
    price: "$4.990",
    period: "CLP / mes",
    description: "Todo lo que necesitas para tu consulta.",
    cta: "Probar 14 días gratis",
    featured: true,
    features: [
      "Sesiones ilimitadas",
      "Transcripción + diarización",
      "1 perfil de voz",
      "Informes y resúmenes IA",
      "Chat IA independiente por paciente",
      "Agenda con Google Calendar",
      "Tests psicológicos integrados",
      "Sesiones por Meet/Zoom",
      "Enlace privado para reserva de horas",
      "Soporte prioritario",
    ],
  },
  {
    name: "Avanzado",
    price: "Próximamente",
    period: "",
    description: "Para psicólogos con alto volumen.",
    cta: "Próximamente",
    comingSoon: true,
    features: [
      "Todo lo de Estándar, más:",
      "Múltiples perfiles de voz",
      "Búsqueda semántica (RAG) en histórico",
      "Plantillas de informe personalizadas",
      "Exportación masiva de datos",
      "Integraciones avanzadas",
    ],
  },
  {
    name: "Enterprise",
    price: "Próximamente",
    period: "",
    description: "Para centros y equipos multidisciplinarios.",
    cta: "Próximamente",
    comingSoon: true,
    features: [
      "Todo lo de Avanzado, más:",
      "Multi-usuario con roles",
      "Auditoría de accesos",
      "Hosting dedicado en Chile",
      "DPA firmado y onboarding",
      "SLA 99.9% y soporte 24/7",
    ],
  },
]

export function PricingSection() {
  return (
    <section
      id="precios"
      aria-label="Planes y precios"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid mask-radial-fade opacity-40" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Precios"
          title={
            <>
              Paga menos de lo que{" "}
              <span className="gradient-primary-text">cuesta una sesión</span>
            </>
          }
          description="Sin permanencia, sin tarjeta para la prueba. Empieza gratis 14 días y cancela cuando quieras."
        />

        <div className="mt-20 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "relative flex flex-col rounded-3xl p-8",
                plan.featured
                  ? "card-premium-featured lg:-mt-6 lg:mb-6"
                  : "card-premium overflow-hidden",
                plan.comingSoon && "opacity-60"
              )}
            >
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
                {plan.featured && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full gradient-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-primary/40">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Más elegido
                  </span>
                )}
                {plan.comingSoon && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ring-1 ring-border">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Próximamente
                  </span>
                )}
              </div>

              <div className="relative mt-6 flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-bold tracking-tight",
                    plan.comingSoon
                      ? "text-2xl text-muted-foreground"
                      : "text-5xl",
                    plan.featured && !plan.comingSoon
                      ? "gradient-primary-text"
                      : !plan.comingSoon
                        ? "text-foreground"
                        : ""
                  )}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                )}
              </div>

              <div className="relative my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <ul className="relative flex-1 space-y-3.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={cn(
                      "flex items-start gap-3 text-sm",
                      plan.comingSoon
                        ? "text-muted-foreground"
                        : "text-foreground/85"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                        plan.featured && !plan.comingSoon
                          ? "bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] shadow-sm shadow-primary/40"
                          : "bg-primary/10 ring-1 ring-primary/20"
                      )}
                    >
                      <Check
                        className={cn(
                          "h-2.5 w-2.5",
                          plan.featured && !plan.comingSoon
                            ? "text-white"
                            : "text-primary"
                        )}
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="relative mt-8">
                {plan.comingSoon ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full cursor-not-allowed opacity-50"
                    disabled
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    variant={plan.featured ? "default" : "outline"}
                    className="w-full"
                  >
                    <Link href={ROUTES.register}>{plan.cta}</Link>
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center text-xs text-muted-foreground"
        >
          Precio real · Sin permanencia
        </motion.p>
      </div>
    </section>
  )
}
