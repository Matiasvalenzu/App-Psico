"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, FileCheck, MousePointerClick, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"

const STEPS = [
  {
    icon: ShieldCheck,
    body: "Autorizas a Psiconex una sola vez desde tu propio SII, y Psiconex lo verifica.",
  },
  {
    icon: MousePointerClick,
    body: "Registras el cobro y confirmas la boleta con un clic.",
  },
  {
    icon: FileCheck,
    body: "Psiconex guarda el folio, el estado y el PDF.",
  },
]

export function BoletasSection() {
  return (
    <section
      id="boletas"
      aria-label="Cobros y boletas de honorarios"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial-fade opacity-50"
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Plan Plus"
          title={
            <>
              Cobra y emite tu boleta{" "}
              <span className="gradient-primary-text">en un clic</span>
            </>
          }
          description="Registras el cobro de la sesión y emites tu boleta de honorarios desde Psiconex, sin entregar tu clave del SII."
        />

        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.li
                key={step.body}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="card-premium relative overflow-hidden rounded-2xl p-7"
              >
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="icon-tile h-12 w-12">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                      Paso {i + 1}
                    </span>
                  </div>
                  <p className="mt-5 text-base leading-relaxed text-foreground">
                    {step.body}
                  </p>
                </div>
              </motion.li>
            )
          })}
        </ol>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-col items-center gap-5 text-center"
        >
          <p className="max-w-2xl text-balance text-base text-muted-foreground">
            Además, sigue tus pagos pendientes y calcula la retención por ti.
          </p>
          <Button asChild size="lg">
            <Link href="/#precios">
              Conoce el Plan Plus
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
