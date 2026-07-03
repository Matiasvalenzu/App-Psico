"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface Segment {
  speaker: "psicologo" | "paciente"
  name: string
  initials: string
  time: string
  text: string
}

const SEGMENTS: Segment[] = [
  {
    speaker: "psicologo",
    name: "Dra. Carla",
    initials: "C",
    time: "00:42",
    text: "¿Qué notaste esta semana cuando aparecía esa sensación de ahogo?",
  },
  {
    speaker: "paciente",
    name: "Paciente",
    initials: "P",
    time: "00:58",
    text: "Siempre era después de leer mensajes del trabajo. Como un peso en el pecho que no se iba.",
  },
  {
    speaker: "psicologo",
    name: "Dra. Carla",
    initials: "C",
    time: "01:35",
    text: "Volvió la rumiación nocturna que vimos en marzo. ¿Probaste el ejercicio de defusión?",
  },
  {
    speaker: "paciente",
    name: "Paciente",
    initials: "P",
    time: "01:52",
    text: "Sí, pero solo dos veces. Cuesta acordarse a esa hora.",
  },
]

export function TranscriptPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10",
        className
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive/70" />
          <span className="h-3 w-3 rounded-full bg-warning/70" />
          <span className="h-3 w-3 rounded-full bg-success/70" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Transcribiendo · sesión 12
        </div>
        <span className="text-xs font-mono text-muted-foreground">12:32</span>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5 md:p-6">
        {SEGMENTS.map((seg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.45,
              delay: i * 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex items-start gap-3"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                seg.speaker === "psicologo"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {seg.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {seg.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {seg.time}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                {seg.text}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Live typing dots */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: SEGMENTS.length * 0.12 + 0.1 }}
          className="flex items-center gap-3 pt-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            P
          </div>
          <div className="flex gap-1 rounded-full bg-muted px-3 py-2">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
