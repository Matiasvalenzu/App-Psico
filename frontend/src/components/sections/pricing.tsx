"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Check, Sparkles } from "lucide-react"
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
}

const PLANS: Plan[] = [
  {
    name: "Solo",
    price: "$29.000",
    period: "CLP / mes",
    description: "Para psicólogos en consulta privada.",
    cta: "Empezar gratis",
    features: [
      "Hasta 40 sesiones / mes",
      "Transcripción + diarización",
      "1 perfil de voz",
      "Informes y resúmenes IA",
      "Agenda con Google Calendar",
      "Soporte por correo",
    ],
  },
  {
    name: "Práctica",
    price: "$59.000",
    period: "CLP / mes",
    description: "Pensado para psicólogos con alto volumen.",
    cta: "Probar 14 días",
    featured: true,
    features: [
      "Sesiones ilimitadas",
      "Todo lo de Solo, más:",
      "Tests psicológicos integrados",
      "Búsqueda semántica (RAG) en histórico",
      "Sesiones por Meet/Zoom",
      "Plantillas de informe personalizadas",
      "Soporte prioritario",
    ],
  },
  {
    name: "Clínica",
    price: "A medida",
    period: "facturación anual",
    description: "Para centros y equipos multidisciplinarios.",
    cta: "Hablar con ventas",
    features: [
      "Todo lo de Práctica, más:",
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
                  : "card-premium overflow-hidden"
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
              </div>

              <div className="relative mt-6 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-5xl font-bold tracking-tight",
                    plan.featured ? "gradient-primary-text" : "text-foreground"
                  )}
                >
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>

              <div className="relative my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <ul className="relative flex-1 space-y-3.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-foreground/85"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                        plan.featured
                          ? "bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] shadow-sm shadow-primary/40"
                          : "bg-primary/10 ring-1 ring-primary/20"
                      )}
                    >
                      <Check
                        className={cn(
                          "h-2.5 w-2.5",
                          plan.featured ? "text-white" : "text-primary"
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
                <Button
                  asChild
                  size="lg"
                  variant={plan.featured ? "default" : "outline"}
                  className="w-full"
                >
                  <Link
                    href={
                      plan.name === "Clínica"
                        ? "mailto:hola@psiconex.app?subject=Plan%20Cl%C3%ADnica"
                        : ROUTES.register
                    }
                  >
                    {plan.cta}
                  </Link>
                </Button>
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
          Precios placeholder mientras afinamos el pricing final · Boleta/factura
          chilena · Sin permanencia
        </motion.p>
      </div>
    </section>
  )
}
