"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, FileCheck, FileDown, MousePointerClick, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"

/*
 * Boletas: una boleta de honorarios electrónica (datos ficticios, sin logo oficial)
 * sale de una ranura y sus campos se completan uno tras otro.
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
  const [impresa, setImpresa] = useState(false)
  const on = reduce || impresa
  // Aparición secuencial de cada campo de la boleta
  const campo = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 6, filter: "blur(3px)" },
          animate: on ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined,
          transition: { duration: 0.45, delay: 0.9 + i * 0.22, ease: EASE },
        }

  return (
    <section
      id="boletas"
      aria-label="Cobros y boletas de honorarios"
      className="section-perf relative overflow-hidden py-20 md:py-28 lg:py-32"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial-fade opacity-50" />
      <div aria-hidden="true" className="glow-blob right-[10%] top-1/3 -z-10 size-80 bg-primary/20" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-16 lg:px-8">
        {/* Texto, pasos y CTA */}
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

          <ol className="mt-10 space-y-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.li
                  key={step.body}
                  initial={reduce ? false : { opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
                  className="flex gap-4"
                >
                  <span className="gradient-primary-text w-8 shrink-0 text-4xl font-bold leading-none">{i + 1}</span>
                  <div>
                    <p className="text-base leading-relaxed text-foreground">{step.body}</p>
                    <motion.span
                      initial={reduce ? false : { opacity: 0, scale: 1.6, rotate: -8 }}
                      whileInView={{ opacity: 1, scale: 1, rotate: -2 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.5 + i * 0.3, ease: EASE }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border-2 border-primary/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary"
                    >
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {step.stamp}
                    </motion.span>
                  </div>
                </motion.li>
              )
            })}
          </ol>

          <div className="mt-10 flex flex-col gap-5 max-lg:items-center max-lg:text-center">
            <p className="max-w-xl text-base text-muted-foreground">
              Además, sigue tus pagos pendientes y calcula la retención por ti.
            </p>
            <Button asChild size="lg" className="w-fit">
              <a href="#precios">
                Conoce el Plan Plus
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>

        {/* Boleta ilustrativa */}
        <div className="relative mx-auto w-full max-w-[30rem]" aria-label="Ejemplo ficticio de boleta de honorarios electrónica" role="img">
          <div aria-hidden="true" className="relative z-20 mx-auto h-5 w-[calc(100%+1.5rem)] -translate-x-3 rounded-full bg-gradient-to-r from-primary to-[hsl(280_75%_64%)] shadow-lg shadow-primary/40">
            <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-black/25" />
          </div>

          <div aria-hidden="true" className="relative -mt-2.5 overflow-hidden px-1 pb-8">
            <motion.div
              initial={reduce ? false : { y: "-100%" }}
              whileInView={{ y: "0%" }}
              viewport={{ once: true, margin: "-120px" }}
              onViewportEnter={() => setImpresa(true)}
              transition={{ duration: 1.1, ease: EASE }}
              className="relative bg-white px-5 pb-5 pt-6 font-sans text-[11px] leading-snug text-neutral-800 shadow-2xl shadow-primary/20 sm:px-7 sm:text-xs"
            >
              <span className="absolute right-3 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                Ejemplo ficticio
              </span>

              {/* Encabezado */}
              <div className="mt-2 flex items-start justify-between gap-3">
                <motion.div {...campo(0)} className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-tight text-neutral-900 sm:text-base">Ps. Camila Rojas</p>
                  <p>RUT: 11.111.111-1</p>
                  <p className="uppercase">Giro(s): Servicios de psicología</p>
                  <p className="uppercase">Av. Ejemplo 123, Santiago</p>
                </motion.div>
                <motion.div {...campo(1)} className="relative shrink-0 border-2 border-red-600 px-2 py-1.5 text-center text-[9px] font-bold uppercase leading-tight text-red-600 sm:px-3 sm:text-[10px]">
                  Boleta de honorarios
                  <br />
                  electrónica
                  <p className="mt-1 text-xs sm:text-sm">N° 000123</p>
                  <motion.span
                    initial={reduce ? false : { opacity: 0, scale: 2.2, rotate: -20 }}
                    animate={on ? { opacity: 1, scale: 1, rotate: -12 } : undefined}
                    transition={{ duration: 0.4, delay: 3.2, ease: EASE }}
                    className="absolute -bottom-5 -left-8 whitespace-nowrap rounded border-2 border-primary bg-white/90 px-1.5 py-0.5 font-mono text-[9px] text-primary shadow-sm"
                  >
                    Folio asignado
                  </motion.span>
                </motion.div>
              </div>

              <motion.p {...campo(2)} className="mt-5">
                <span className="font-semibold">Fecha:</span> 14 de octubre de 2026
              </motion.p>

              {/* Receptor */}
              <motion.div {...campo(3)} className="mt-2 space-y-0.5 border-t border-neutral-300 pt-2">
                <p>
                  <span className="font-semibold">Señor(es):</span> Paciente ficticio{" "}
                  <span className="ml-2 font-semibold">Rut:</span> 22.222.222-2
                </p>
                <p>
                  <span className="font-semibold">Domicilio:</span> Calle Ficticia 456, Santiago
                </p>
              </motion.div>

              {/* Detalle */}
              <motion.div {...campo(4)} className="mt-3 border border-neutral-300">
                <div className="flex justify-between bg-neutral-100 px-2 py-1 font-semibold">
                  <span>Por atención profesional:</span>
                  <span>Monto</span>
                </div>
                <div className="flex justify-between px-2 py-1.5">
                  <span className="uppercase">Atención psicológica</span>
                  <span className="tabular-nums">$40.000</span>
                </div>
              </motion.div>

              {/* Totales */}
              <div className="mt-2 ml-auto w-full max-w-[15rem] space-y-0.5 tabular-nums">
                <motion.p {...campo(5)} className="flex justify-between">
                  <span className="font-semibold">Total Honorarios:</span> <span>$40.000</span>
                </motion.p>
                <motion.p {...campo(6)} className="flex justify-between">
                  <span>15,25% Impto. Retenido:</span> <span>$6.100</span>
                </motion.p>
                <motion.p {...campo(7)} className="flex justify-between border-t border-neutral-300 pt-0.5 font-semibold">
                  <span>Líquido:</span> <span>$33.900</span>
                </motion.p>
              </div>

              {/* Pie */}
              <motion.div {...campo(8)} className="mt-4 flex items-end justify-between gap-3 border-t border-dashed border-neutral-300 pt-2 text-[9px] text-neutral-500">
                <div>
                  <p>Fecha / Hora Emisión: 14/10/2026 10:30</p>
                  <p>Documento de ejemplo, sin validez tributaria.</p>
                  <p className="font-semibold tracking-wide text-neutral-600">Servicio de Impuestos Internos</p>
                </div>
                <motion.span
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={on ? { opacity: 1, y: 0 } : undefined}
                  transition={{ duration: 0.4, delay: 3.6, ease: EASE }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-primary to-[hsl(280_75%_64%)] px-2.5 py-1 text-[10px] font-semibold text-white shadow-md shadow-primary/30"
                >
                  <FileDown className="h-3 w-3" /> PDF listo
                </motion.span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
