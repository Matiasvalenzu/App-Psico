"use client"

import { motion } from "motion/react"

const TRUST_BADGES = [
  "Cumple Ley 19.628",
  "Cifrado AES-256",
  "Datos en Chile",
  "Auditoría de accesos",
  "Sin entrenamiento con tus datos",
]

export function TrustSection() {
  return (
    <section
      aria-label="Confianza y cumplimiento"
      className="border-y border-border/60 bg-muted/30 py-10"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Construido con estándares clínicos
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:gap-x-12">
          {TRUST_BADGES.map((badge, i) => (
            <motion.span
              key={badge}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-sm font-medium text-foreground/70"
            >
              {badge}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  )
}
