"use client"

import { useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { Check, Clock, FileSpreadsheet, Receipt, Sparkles, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"
import { ROUTES } from "@/lib/config"
import { cn } from "@/lib/utils"

const FUNCIONES_ESTANDAR = [
  "Sesiones ilimitadas",
  "Transcripción + diarización",
  "1 perfil de voz",
  "Informes y resúmenes IA",
  "Chat IA independiente por paciente",
  "Agenda con Google Calendar",
  "Test de Creencias Ellis y Rueda de la Vida",
  "Videollamada propia de Psiconex",
  "Enlace privado para reserva de horas",
  "Recordatorios por correo a tus pacientes",
  "Exportación completa de tus datos",
]

const FUNCIONES_PLUS_ADMINISTRACION = [
  "Boletas de honorarios electrónicas en el SII con un clic desde cada cobro, sin entregar tu clave: Psiconex las emite como usuario autorizado",
  "Registro de pagos por paciente: fecha, monto, medio de pago y si está pagado o pendiente",
  "El PDF de cada boleta guardado y listo para descargar desde la ficha",
  "Cálculo automático de la retención: monto bruto, retención y lo que declaras en tu F29, según quién retiene",
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

function seleccionarConTeclado(event: KeyboardEvent, elegir: () => void) {
  if (event.target !== event.currentTarget) return
  if (event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  elegir()
}

export function PricingSection() {
  const [seleccionado, setSeleccionado] = useState<"estandar" | "plus">("plus")

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
              Precio en pesos,{" "}
              <span className="gradient-primary-text">sin sorpresas.</span>
            </>
          }
          description="Estándar a $4.990 y Plus a $9.990 al mes; Plus incluye tus boletas de honorarios. Sin cobro por paciente."
        />

        <div
          role="group"
          aria-label="Elige un plan"
          className="mx-auto mt-20 grid max-w-5xl items-stretch gap-6 lg:grid-cols-2"
        >
          <motion.div
            {...animacion(0)}
            role="button"
            aria-pressed={seleccionado === "estandar"}
            tabIndex={0}
            onClick={() => setSeleccionado("estandar")}
            onKeyDown={(event) => seleccionarConTeclado(event, () => setSeleccionado("estandar"))}
            className={cn(
              "relative flex h-full cursor-pointer flex-col rounded-3xl p-8 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              seleccionado === "estandar" ? "card-premium-featured" : "card-premium"
            )}
          >
            <div className="min-h-[4.75rem]">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Estándar</h3>
              <p className="mt-1 text-sm text-muted-foreground">Todo lo clínico de tu consulta.</p>
            </div>
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
              <div className="mt-2.5 min-h-[4.75rem] text-center">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  14 días gratis sin tarjeta. Después de la prueba: $4.990/mes. Sin permanencia. Cancela cuando quieras.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            {...animacion(1)}
            role="button"
            aria-pressed={seleccionado === "plus"}
            tabIndex={0}
            onClick={() => setSeleccionado("plus")}
            onKeyDown={(event) => seleccionarConTeclado(event, () => setSeleccionado("plus"))}
            className={cn(
              "relative flex h-full cursor-pointer flex-col rounded-3xl p-8 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              seleccionado === "plus" ? "card-premium-featured" : "card-premium"
            )}
          >
            <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 whitespace-nowrap items-center gap-1 rounded-full gradient-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-primary/40">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Recomendado
            </span>
            <div className="min-h-[4.75rem]">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Plus</h3>
              <p className="mt-1 text-sm font-medium text-foreground/90">
                Tu consulta clínica y administrativa en un solo lugar
              </p>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className={cn("text-5xl font-bold tracking-tight", seleccionado === "plus" && "gradient-primary-text")}>$9.990</span>
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
                <ListaFunciones items={FUNCIONES_PLUS_ADMINISTRACION} destacada={seleccionado === "plus"} />
                <p className="mt-4 text-xs leading-snug text-muted-foreground">
                  Para emitir boletas autorizas a Psiconex en el SII; revisamos esa autorización antes de activar la emisión.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <Button asChild size="lg" className="w-full">
                <a href={ROUTES.register} data-plan="plus">Suscribirme a Plus</a>
              </Button>
              <div className="mt-2.5 min-h-[4.75rem] text-center">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Entras a Psiconex e ingresas la tarjeta ahí. El primer cobro es al confirmar.
                </p>
                <p className="mt-2 text-xs">
                  <Link href={ROUTES.register} className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" data-meta-lead>
                    ¿Prefieres probar primero? 14 días gratis
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Importación de pacientes */}
        <motion.div {...animacion(2)} className="card-premium mx-auto mt-10 flex max-w-5xl flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
          <span className="icon-tile h-11 w-11 shrink-0">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">¿Ya tienes tus pacientes en una planilla?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Impórtalos desde Excel o CSV: Psiconex reconoce las columnas y te muestra lo
              que va a crear antes de confirmar. Solo datos de contacto y
              administrativos; nunca notas clínicas.
            </p>
          </div>
        </motion.div>

        {/* Próximamente */}
        <motion.div {...animacion(2)} className="mx-auto mt-4 grid max-w-5xl gap-4 sm:grid-cols-2">
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
