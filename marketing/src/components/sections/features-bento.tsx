"use client"

import { motion } from "motion/react"
import {
  AudioLines,
  Fingerprint,
  Search,
  FileText,
  ClipboardList,
  Calendar,
  Video,
  ShieldCheck,
} from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"
import { cn } from "@/lib/utils"

interface Feature {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  title: string
  body: string
  className?: string
  visual?: React.ReactNode
  badge?: string
}

const FEATURES: Feature[] = [
  {
    icon: AudioLines,
    title: "Transcripción y diarización clínica",
    body: "Whisper distingue tu voz de la del paciente y entrega minutas con timestamps en minutos, no en horas.",
    className: "md:col-span-2",
    visual: <WaveformVisual />,
    badge: "IA",
  },
  {
    icon: Fingerprint,
    title: "Biometría de voz con ECAPA-TDNN",
    body: "Tu perfil de voz se entrena una vez. Después la IA reconoce quién habla aunque cambien de paciente.",
    className: "md:col-span-1",
    visual: <FingerprintVisual />,
    badge: "Único",
  },
  {
    icon: Search,
    title: "Memoria semántica del paciente",
    body: "RAG con pgvector: pregunta '¿qué dijo en marzo sobre su madre?' y obtén el fragmento exacto.",
  },
  {
    icon: FileText,
    title: "Informes y resúmenes en segundos",
    body: "Resúmenes de sesión, evolución, derivaciones e informes clínicos generados con DeepSeek y tu plantilla.",
  },
  {
    icon: ClipboardList,
    title: "Tests psicológicos aplicados",
    body: "PHQ-9, GAD-7, BAI/BDI: aplica, puntúa e interpreta con un click. Resultados guardados en la ficha.",
  },
  {
    icon: Calendar,
    title: "Agenda con Google Calendar",
    body: "Sincroniza sesiones con tu calendario. Recordatorios automáticos al paciente por correo.",
  },
  {
    icon: Video,
    title: "Sesiones por Meet o Zoom",
    body: "Graba la videollamada y la transcribe igual que las presenciales. Mismo pipeline, mismo informe.",
  },
  {
    icon: ShieldCheck,
    title: "Datos cifrados de extremo a extremo",
    body: "AES-256 en reposo, TLS 1.3 en tránsito. Cumple Ley 19.628 de protección de datos personales.",
  },
]

function WaveformVisual() {
  const bars = Array.from({ length: 24 })
  return (
    <div className="relative mt-6 h-32 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background/80 to-background p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,hsl(var(--primary)/0.15),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />
      <div className="relative flex h-full items-center justify-center gap-[5px]">
        {bars.map((_, i) => {
          const height = 22 + Math.abs(Math.sin(i * 0.7)) * 62 + (i % 4) * 4
          const isCarla = i < 9 || (i >= 16 && i < 21)
          return (
            <motion.span
              key={i}
              initial={{ scaleY: 0.25 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.55,
                delay: i * 0.025,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ height: `${height}%` }}
              className={cn(
                "w-[3px] rounded-full origin-center",
                isCarla
                  ? "bg-gradient-to-t from-primary/60 to-primary"
                  : "bg-gradient-to-t from-[hsl(280_75%_64%)/0.6] to-[hsl(280_75%_64%)]"
              )}
            />
          )
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-4 top-2 flex items-center justify-between text-[10px] font-mono">
        <span className="flex items-center gap-1.5 text-foreground/70">
          <span className="size-1.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
          Dra. Carla
        </span>
        <span className="flex items-center gap-1.5 text-foreground/70">
          <span className="size-1.5 rounded-full bg-[hsl(280_75%_64%)] shadow-sm shadow-[hsl(280_75%_64%)]/50" />
          Paciente
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-2 flex justify-between text-[9px] font-mono text-muted-foreground/60">
        <span>00:00</span>
        <span>50:00</span>
      </div>
    </div>
  )
}

function FingerprintVisual() {
  return (
    <div className="relative mt-6 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background/80 to-background">
      {/* ambient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.22),transparent_65%)]"
      />
      {/* concentric rings — 2 anillos, ciclo más lento, GPU friendly */}
      {[0, 1.5].map((delay, i) => (
        <motion.div
          key={i}
          animate={{ scale: [0.7, 1.8], opacity: [0.55, 0] }}
          transition={{
            duration: 3.4,
            delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{ willChange: "transform, opacity" }}
          className="absolute size-16 rounded-full border border-primary/60"
        />
      ))}
      <div
        className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] shadow-lg shadow-primary/40"
      >
        <Fingerprint className="h-7 w-7 text-white" aria-hidden="true" />
      </div>
      {/* score chip */}
      <div className="absolute right-3 top-3 rounded-md border border-primary/30 bg-background/80 px-2 py-1 text-[10px] font-mono text-primary backdrop-blur-sm">
        match 0.91
      </div>
    </div>
  )
}

export function FeaturesBentoSection() {
  return (
    <section
      id="producto"
      aria-label="Funciones de Psiconex"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      {/* Ambient backdrop — estático para no pelear con el scroll */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden">
        <div className="absolute inset-0 bg-grid mask-radial-fade opacity-50" />
        <div className="glow-blob left-1/4 top-20 size-72 bg-primary/25" />
        <div className="glow-blob right-1/4 top-32 size-80 bg-[hsl(280_75%_64%)]/20" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Funciones"
          title={
            <>
              Todo el flujo clínico,{" "}
              <span className="gradient-primary-text">en un solo lugar</span>
            </>
          }
          description="Ocho herramientas pensadas para psicólogos, no para informáticos. Diseñadas con clínicos chilenos en ejercicio."
        />

        <div className="mt-16 grid auto-rows-fr gap-5 md:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.6,
                  delay: (i % 3) * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "group card-premium relative overflow-hidden rounded-2xl p-7",
                  feature.className
                )}
              >
                <div className="relative flex items-start justify-between">
                  <div className="icon-tile h-11 w-11">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  {feature.badge && (
                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <h3 className="relative mt-5 text-base font-semibold tracking-tight text-foreground">
                  {feature.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
                {feature.visual}
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
