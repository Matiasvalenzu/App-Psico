"use client"

import { motion } from "motion/react"
import { Clock, FileText, Brain } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"

const PAINS = [
  {
    icon: Clock,
    title: "Tres horas de notas por cada sesión",
    body: "Pasas la tarde transcribiendo a mano lo que tu paciente ya te contó. El día se hace eterno y la familia espera.",
    stat: "3h",
    statLabel: "perdidas / día",
  },
  {
    icon: Brain,
    title: "Pierdes el matiz mientras escribes",
    body: "Mientras tipeas, dejas de escuchar. La pausa, el quiebre de voz, la palabra exacta que abrió el insight: se va.",
    stat: "62%",
    statLabel: "del foco se va",
  },
  {
    icon: FileText,
    title: "Fichas incompletas, informes que duelen",
    body: "A los 6 meses no recuerdas qué se trabajó. Cuando llega el informe, reconstruyes a memoria lo que debía estar registrado.",
    stat: "6m",
    statLabel: "para olvidar todo",
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
          description="Hablamos con más de 40 psicólogos en Chile. Estos tres dolores se repitieron en cada conversación."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PAINS.map((pain, i) => {
            const Icon = pain.icon
            const num = String(i + 1).padStart(2, "0")
            return (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group card-premium relative overflow-hidden rounded-2xl p-7"
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

                  <div className="mt-6 flex items-baseline gap-2 border-t border-border/60 pt-4">
                    <span className="text-2xl font-bold tracking-tight gradient-primary-text">
                      {pain.stat}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {pain.statLabel}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
