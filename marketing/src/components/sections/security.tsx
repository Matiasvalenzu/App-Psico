"use client"

import { motion } from "motion/react"
import { Lock, Server, Eye, FileKey } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"

const PILLARS = [
  {
    icon: Lock,
    title: "Cifrado AES-256",
    body: "Audios, transcripciones y embeddings cifrados en reposo. TLS 1.3 en tránsito.",
    chip: "AES-256",
  },
  {
    icon: Server,
    title: "Datos alojados en Chile",
    body: "Toda la información clínica vive en servidores chilenos. Sin transferencia a EE.UU.",
    chip: "Santiago, CL",
  },
  {
    icon: Eye,
    title: "Cero entrenamiento con tus datos",
    body: "Ni Whisper, ni DeepSeek, ni Pyannote ven tus sesiones para mejorar sus modelos. Punto.",
    chip: "Opt-out total",
  },
  {
    icon: FileKey,
    title: "Ley 19.628 + GDPR",
    body: "Borrado a petición, portabilidad, registro de accesos. Cumple normativa chilena y europea.",
    chip: "Compliant",
  },
]

export function SecuritySection() {
  return (
    <section
      id="seguridad"
      aria-label="Seguridad y privacidad"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-dots opacity-50 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_100%,#000_30%,transparent_80%)]" />
        <div className="glow-blob left-1/2 top-1/2 size-96 -translate-x-1/2 bg-primary/15" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Seguridad"
          title={
            <>
              La privacidad{" "}
              <span className="gradient-primary-text">no es un feature</span>
            </>
          }
          description="Es la base. Construido desde el primer commit para resistir auditorías clínicas y cumplir la Ley 19.628."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p, i) => {
            const Icon = p.icon
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group card-premium relative overflow-hidden rounded-2xl p-6"
              >
                <div className="relative flex items-start justify-between">
                  <div className="icon-tile h-11 w-11">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {p.chip}
                  </span>
                </div>
                <h3 className="relative mt-5 text-sm font-semibold tracking-tight text-foreground">
                  {p.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                {/* status bar */}
                <div className="relative mt-5 flex items-center gap-2 border-t border-border/60 pt-4">
                  <span className="relative flex size-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
                    <span className="relative size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Activo
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center text-xs text-muted-foreground"
        >
          ¿Necesitas un acuerdo de procesamiento de datos (DPA)? Lo firmamos.
        </motion.p>
      </div>
    </section>
  )
}
