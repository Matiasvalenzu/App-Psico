"use client"

import { motion } from "motion/react"
import { Fragment } from "react"
import { ArrowDown, Clock, FileText, Brain, Receipt } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"

const PAINS = [
  {
    icon: Clock,
    title: "Las notas se escriben fuera de horario",
    body: "Terminas la jornada y todavía te falta pasar limpio lo que tu paciente ya te contó. La tarde se alarga.",
    solution: "Al terminar la sesión ya tienes la transcripción, con las voces separadas, lista para tu registro.",
  },
  {
    icon: Brain,
    title: "Escribir mientras escuchas cuesta atención",
    body: "Mientras anotas, dejas de mirar. La pausa, el quiebre de voz o la palabra exacta que abrió el insight pueden perderse.",
    solution: "Psiconex graba con el consentimiento de tu paciente, para que tú solo lo mires y lo escuches.",
  },
  {
    icon: FileText,
    title: "Fichas incompletas, informes que cansan",
    body: "Meses después ya no recuerdas todo lo que se trabajó. Cuando llega el informe, reconstruyes de memoria lo que debía estar registrado.",
    solution: "Cada sesión queda en la ficha. Pides al chat IA un borrador de informe y lo descargas en PDF o Word.",
  },
  {
    icon: Receipt,
    title: "Emitir boletas y perseguir pagos a fin de mes",
    body: "Horas de trámite que podrías dedicar a tus pacientes.",
    solution: "Registra tus cobros, ve quién te debe y emite tu boleta en un clic, sin entregar tu clave del SII (Plan Plus).",
  },
]

export function ProblemSection() {
  return (
    <section
      id="problema"
      aria-label="El problema"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial-fade opacity-60"
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="El problema"
          title={
            <>
              La parte administrativa{" "}
              <span className="gradient-primary-text">te quita la clínica</span>
            </>
          }
          description="Cuatro situaciones que se repiten en la consulta de muchos psicólogos."
        />

        <div className="mx-auto mt-16 grid max-w-xl lg:max-w-none lg:grid-flow-col lg:grid-cols-4 lg:grid-rows-[auto_auto_auto] lg:gap-x-6">
          {PAINS.map((pain, i) => {
            const Icon = pain.icon
            const num = String(i + 1).padStart(2, "0")
            return (
              <Fragment key={pain.title}>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.1,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`group card-premium relative overflow-hidden rounded-2xl p-7 ${i > 0 ? "mt-10 lg:mt-0" : ""}`}
                >
                  <span aria-hidden="true" className="number-watermark">
                    {num}
                  </span>

                  <div className="relative">
                    <div className="icon-tile h-12 w-12">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>

                    <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
                      {pain.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {pain.body}
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.1 + 0.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  aria-hidden="true"
                  className="mx-auto my-3 grid size-9 place-items-center rounded-full bg-primary text-white"
                >
                  <ArrowDown className="h-5 w-5" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.1 + 0.25,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="rounded-2xl border border-violet-300 bg-violet-50 p-7 dark:border-violet-700 dark:bg-violet-950/40"
                >
                  <p className="text-sm font-bold text-violet-700 dark:text-violet-300">✓ Con Psiconex</p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">{pain.solution}</p>
                </motion.div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}
