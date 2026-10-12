"use client"

import { motion } from "motion/react"
import { Mic, Sparkles, FileText } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"

const STEPS = [
  {
    icon: Mic,
    eyebrow: "Paso 1",
    title: "Graba la sesión",
    body: "Graba desde el navegador (también el audio de tu videollamada, compartiendo la pestaña o pantalla) o usa la extensión de Chrome para captar los subtítulos de Meet o Zoom.",
    detail: "El audio se sube por una conexión cifrada (HTTPS).",
  },
  {
    icon: Sparkles,
    eyebrow: "Paso 2",
    title: "La IA hace el trabajo pesado",
    body: "Transcribe la sesión, separa las voces, ordena los puntos clave y deja el historial listo para consultarlo. Tú revisas y corriges.",
    detail: "El audio se elimina en cuanto termina la transcripción.",
  },
  {
    icon: FileText,
    eyebrow: "Paso 3",
    title: "Recibes la ficha completa",
    body: "Transcripción diarizada, resumen ejecutivo, evolución del paciente, items para próxima sesión y un borrador de informe que tú revisas y editas.",
    detail: "Todo editable. La IA propone, tú decides.",
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      aria-label="Cómo funciona Psiconex"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Cómo funciona"
          title={
            <>
              Del audio al informe,{" "}
              <span className="gradient-primary-text">sin tocar el teclado</span>
            </>
          }
          description="Tres pasos, de la sesión al borrador que tú revisas."
        />

        <div className="relative mt-20">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-12 hidden h-[calc(100%-3rem)] w-px -translate-x-1/2 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent lg:block"
          />

          <ol className="space-y-16 lg:space-y-24">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              const isReverse = i % 2 === 1
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.7,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-12"
                >
                  {/* Text */}
                  <div
                    className={
                      isReverse
                        ? "order-2 lg:order-none lg:col-start-3 lg:text-left text-center"
                        : "order-2 lg:order-none lg:text-right text-center"
                    }
                  >
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                      {step.eyebrow}
                    </span>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-base text-muted-foreground">
                      {step.body}
                    </p>
                    <p className="mt-3 text-sm text-foreground/70">
                      {step.detail}
                    </p>
                  </div>

                  {/* Center icon */}
                  <div className="relative mx-auto order-1 lg:order-none lg:col-start-2 lg:row-start-1">
                    <motion.div
                      whileInView={{ scale: [0.8, 1.1, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="relative flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-xl shadow-primary/25"
                    >
                      <Icon className="h-9 w-9" aria-hidden="true" />
                      <span
                        className="absolute -inset-2 -z-10 rounded-3xl bg-primary/20 blur-xl"
                        aria-hidden="true"
                      />
                    </motion.div>
                  </div>

                  {/* Spacer */}
                  <div
                    className={
                      isReverse
                        ? "hidden lg:block lg:col-start-1 lg:row-start-1"
                        : "hidden lg:block lg:col-start-3 lg:row-start-1"
                    }
                  />
                </motion.li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
