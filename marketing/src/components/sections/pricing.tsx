"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Check, Clock, Receipt, Sparkles, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"
import { PLUS_URL, ROUTES } from "@/lib/config"
import { cn } from "@/lib/utils"

const FUNCIONES_ESTANDAR = [
  "Sesiones ilimitadas",
  "Transcripción + diarización",
  "1 perfil de voz",
  "Informes y resúmenes IA",
  "Chat IA independiente por paciente",
  "Agenda con Google Calendar",
  "Test de Creencias Ellis y Rueda de la Vida",
  "Registro de sesiones online (Meet y Zoom)",
  "Enlace privado para reserva de horas",
  "Recordatorios por correo a tus pacientes",
  "Exportación completa de tus datos",
]

const FUNCIONES_PLUS_ADMINISTRACION = [
  "Boletas de honorarios electrónicas en el SII con un clic desde cada cobro, sin entregar tu clave: Psiconex las emite como usuario autorizado",
  "Registro de pagos por paciente: fecha, monto, medio de pago y si está pagado o pendiente",
  "Estado de cada boleta al momento: en cola, en emisión, emitida con su folio o anulada",
  "El PDF de cada boleta guardado y listo para descargar desde la ficha",
  "Cálculo automático de la retención: monto bruto, retención y lo que declaras en tu F29, según quién retiene",
  "Guía paso a paso para anular una boleta en el SII y dejar registro de que lo hiciste",
  "Historial de cobros y boletas de cada paciente",
]

const PROXIMAMENTE = [
  { name: "Avanzado", description: "Para psicólogos con alto volumen: varios perfiles de voz y plantillas de informe propias." },
  { name: "Enterprise", description: "Para centros y equipos multidisciplinarios, con condiciones a medida." },
]

const animacion = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const },
})

function ListaFunciones({ items, destacada }: { items: string[]; destacada?: boolean }) {
  return (
    <ul className="space-y-3.5">
      {items.map((feature) => (
        <li key={feature} className="flex items-start gap-3 text-sm text-foreground/85">
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
              destacada
                ? "bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] shadow-sm shadow-primary/40"
                : "bg-primary/10 ring-1 ring-primary/20"
            )}
          >
            <Check
              className={cn("h-2.5 w-2.5", destacada ? "text-white" : "text-primary")}
              strokeWidth={3}
              aria-hidden="true"
            />
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  )
}

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
          description="Sin permanencia. Prueba gratis 14 días sin tarjeta o suscríbete directo a Plus, y cancela cuando quieras."
        />

        <div className="mx-auto mt-20 grid max-w-5xl gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* Estándar */}
          <motion.div {...animacion(0)} className="card-premium relative flex flex-col overflow-hidden rounded-3xl p-8">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Estándar</h3>
            <p className="mt-1 text-sm text-muted-foreground">Todo lo clínico de tu consulta.</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight text-foreground">$4.990</span>
              <span className="text-sm text-muted-foreground">CLP / mes</span>
            </div>

            <div className="my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="flex-1">
              <ListaFunciones items={FUNCIONES_ESTANDAR} />
            </div>

            <div className="mt-8">
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href={ROUTES.register} data-meta-lead>Probar 14 días gratis</Link>
              </Button>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground leading-snug">
                14 días gratis sin tarjeta. Después de la prueba: $4.990/mes. Sin permanencia. Cancela cuando quieras.
              </p>
            </div>
          </motion.div>

          {/* Plus */}
          <motion.div {...animacion(1)} className="card-premium-featured relative flex flex-col rounded-3xl p-8 lg:-mt-6 lg:mb-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">Plus</h3>
                <p className="mt-1 text-sm font-medium text-foreground/90">
                  Tu consulta clínica y administrativa en un solo lugar
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full gradient-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-primary/40">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Recomendado
              </span>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight gradient-primary-text">$9.990</span>
              <span className="text-sm text-muted-foreground">CLP / mes</span>
            </div>

            <div className="my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="flex-1 space-y-6">
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Stethoscope className="h-4 w-4 text-primary" aria-hidden="true" />
                  Clínico
                </h4>
                <p className="text-sm text-foreground/85">Todo lo del plan Estándar.</p>
              </div>
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
                  Administración y cobros
                </h4>
                <ListaFunciones items={FUNCIONES_PLUS_ADMINISTRACION} destacada />
                <p className="mt-4 text-xs text-muted-foreground leading-snug">
                  Para emitir boletas autorizas a Psiconex en el SII; revisamos esa autorización antes de activar la emisión.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <Button asChild size="lg" className="w-full">
                <a href={PLUS_URL || ROUTES.register} data-plan="plus">Suscribirme a Plus</a>
              </Button>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground leading-snug">
                Pagas en Mercado Pago (primer cobro al suscribirte) y, al volver, inicias sesión o creas tu cuenta y Plus queda activo.
              </p>
              <p className="mt-2 text-center text-xs">
                <Link href={ROUTES.register} className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" data-meta-lead>
                  ¿Prefieres probar primero? 14 días gratis
                </Link>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Próximamente */}
        <motion.div {...animacion(2)} className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
          {PROXIMAMENTE.map((plan) => (
            <div key={plan.name} className="card-premium flex items-start gap-3 rounded-2xl p-5 opacity-70">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {plan.name} <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próximamente</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center text-xs text-muted-foreground"
        >
          Sin permanencia · Cancela cuando quieras · Cobro seguro vía Mercado Pago
        </motion.p>
      </div>
    </section>
  )
}
