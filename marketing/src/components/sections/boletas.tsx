"use client"

import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check, FileCheck, MousePointerClick, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"

/*
 * Boletas: un ticket que se "imprime" desde una ranura al entrar en pantalla.
 * Cada tramo del ticket es un paso; el talón final resume pendientes y retención.
 */

const STEPS = [
  {
    icon: ShieldCheck,
    body: "Autorizas a Psiconex una sola vez desde tu propio Servicio de Impuestos Internos, y Psiconex lo verifica.",
    stamp: "Autorización verificada",
  },
  {
    icon: MousePointerClick,
    body: "Registras el cobro y confirmas la boleta con un clic.",
    stamp: "Sesión pagada · boleta confirmada",
  },
  {
    icon: FileCheck,
    body: "Psiconex guarda el folio, el estado y el PDF.",
    stamp: "Folio · estado · PDF",
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

export function BoletasSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="boletas"
      aria-label="Cobros y boletas de honorarios"
      className="section-perf relative overflow-hidden py-20 md:py-28 lg:py-32"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial-fade opacity-50" />
      <div aria-hidden="true" className="glow-blob right-[10%] top-1/3 -z-10 size-80 bg-primary/20" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-20 lg:px-8">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Plan Plus"
            title={
              <>
                Cobra y emite tu boleta{" "}
                <span className="gradient-primary-text">en un clic</span>
              </>
            }
            description="Deja de ser también la secretaria de tu consulta: registra tus cobros y emite tu boleta de honorarios en un clic, sin entregar tu clave del Servicio de Impuestos Internos."
            className="max-lg:mx-auto max-lg:text-center"
          />
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            className="mt-8 flex flex-col gap-5 max-lg:items-center max-lg:text-center"
          >
            <p className="max-w-xl text-base text-muted-foreground">
              Además, sigue tus pagos pendientes y calcula la retención por ti.
            </p>
            <Button asChild size="lg" className="w-fit">
              <a href="#precios">
                Conoce el Plan Plus
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </motion.div>
        </div>

        {/* Ticket */}
        <div className="relative mx-auto w-full max-w-sm">
          {/* Ranura de la "impresora" */}
          <div aria-hidden="true" className="relative z-20 mx-auto h-5 w-[calc(100%+2rem)] -translate-x-4 rounded-full bg-gradient-to-r from-primary to-[hsl(280_75%_64%)] shadow-lg shadow-primary/40">
            <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-black/25" />
          </div>

          <div className="relative -mt-2.5 overflow-hidden px-1 pb-6">
            <motion.ol
              initial={reduce ? false : { y: "-100%" }}
              whileInView={{ y: "0%" }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 1.6, ease: EASE }}
              className="boleta-ticket relative bg-white px-6 pb-10 pt-8 shadow-2xl shadow-primary/20 dark:bg-card"
            >
              <li aria-hidden="true" className="mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Boleta de honorarios</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-sans font-semibold text-primary">Plus</span>
              </li>
              {STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <li key={step.body} className="relative border-t border-dashed border-primary/25 py-5">
                    <div className="flex gap-4">
                      <span className="gradient-primary-text text-3xl font-bold leading-none">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm leading-relaxed text-foreground">{step.body}</p>
                        <motion.span
                          initial={reduce ? false : { opacity: 0, scale: 1.6, rotate: -8 }}
                          whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.45, delay: 1.1 + i * 0.35, ease: EASE }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-md border-2 border-primary/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary"
                        >
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {step.stamp}
                        </motion.span>
                      </div>
                    </div>
                  </li>
                )
              })}
              <li aria-hidden="true" className="flex items-center justify-between border-t-2 border-dashed border-primary/30 pt-5 text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  Pendientes y retención
                </span>
                <span className="font-mono font-semibold text-primary">al día</span>
              </li>
            </motion.ol>
          </div>
        </div>
      </div>

      <style>{`
        .boleta-ticket {
          --z: 10px;
          -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / calc(2 * var(--z)) 100%;
                  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / calc(2 * var(--z)) 100%;
          border-radius: 0 0 .25rem .25rem;
        }
      `}</style>
    </section>
  )
}
