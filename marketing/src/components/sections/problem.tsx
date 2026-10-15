"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Check, Clock, FileText, Brain, Receipt } from "lucide-react"
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
    solution: "Registra tus cobros, ve quién te debe y emite tu boleta en un clic, sin entregar tu clave del Servicio de Impuestos Internos (Plan Plus).",
  },
]

export function ProblemSection() {
  const reduce = useReducedMotion()
  const [vistos, setVistos] = useState<boolean[]>([])
  return (
    <section
      id="problema"
      aria-label="El problema"
      className="section-perf relative overflow-hidden py-20 md:py-28 lg:py-32"
    >
      <style>{`
        .pb-strike { background-image: linear-gradient(hsl(var(--primary) / .55), hsl(var(--primary) / .55)); background-repeat: no-repeat; background-position: 0 58%; background-size: 0% 2px; transition: background-size .9s cubic-bezier(.22,1,.36,1) .25s, color .6s ease .25s }
        .pb-row[data-on="true"] .pb-strike { background-size: 100% 2px; color: hsl(var(--muted-foreground)) }
        .pb-sweep { transform: scaleX(0); transform-origin: left; transition: transform 1s cubic-bezier(.22,1,.36,1) .45s }
        .pb-row[data-on="true"] .pb-sweep { transform: scaleX(1) }
        @media (prefers-reduced-motion: reduce) { .pb-strike, .pb-sweep { transition: none } }
      `}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial-fade opacity-60" />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
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

        <div aria-hidden="true" className="mx-auto mt-14 hidden max-w-5xl grid-cols-[4.5rem_1fr_1fr] gap-8 px-2 text-xs font-semibold uppercase tracking-widest md:grid">
          <span />
          <span className="text-muted-foreground">Antes</span>
          <span className="text-primary">Con Psiconex</span>
        </div>

        <ol className="mx-auto mt-6 max-w-5xl divide-y divide-primary/10 md:mt-3">
          {PAINS.map((pain, i) => {
            const Icon = pain.icon
            const num = String(i + 1).padStart(2, "0")
            return (
              <motion.li
                key={pain.title}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                onViewportEnter={() => setVistos((v) => { const n = [...v]; n[i] = true; return n })}
                data-on={reduce || vistos[i] ? "true" : "false"}
                className="pb-row relative grid gap-4 py-9 md:grid-cols-[4.5rem_1fr_1fr] md:gap-8 md:py-10"
              >
                <div className="flex items-center gap-3 md:block">
                  <span className="gradient-primary-text text-4xl font-bold leading-none tracking-tight md:text-5xl">{num}</span>
                  <Icon className="h-5 w-5 text-primary/60 md:mt-3" aria-hidden="true" />
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:hidden">Antes</span>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    <span className="pb-strike box-decoration-clone">{pain.title}</span>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pain.body}</p>
                </div>

                <div className="relative rounded-[1.75rem] px-5 py-4 md:-my-2">
                  <span aria-hidden="true" className="pb-sweep absolute inset-0 -z-10 rounded-[1.75rem] bg-gradient-to-r from-primary/12 via-[hsl(280_75%_64%)]/10 to-transparent" />
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-primary md:hidden">Con Psiconex</span>
                  <p className="flex items-start gap-3 text-sm leading-relaxed text-foreground md:text-base">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] text-white shadow-md shadow-primary/30">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span>{pain.solution}</span>
                  </p>
                </div>
              </motion.li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
