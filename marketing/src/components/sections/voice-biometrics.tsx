"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Fingerprint, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/config"

const BENEFITS = [
  "Identifica al psicólogo y al paciente sin etiquetas manuales",
  "Funciona aunque haya ruido de fondo o cambios de tono",
  "Tu voz se entrena una vez con 30 segundos de muestra",
  "Patrones biométricos cifrados y resguardados solo en tu cuenta",
]

export function VoiceBiometricsSection() {
  return (
    <section
      id="biometria"
      aria-label="Biometría de voz"
      className="section-perf relative overflow-hidden py-20 md:py-28 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 gradient-primary opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(280_75%_64%/0.5),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Visual: pulsing waveform + fingerprint */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center"
          >
            {/* Rings — 2 anillos, ciclo más largo */}
            {[0, 1.8].map((delay, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.6],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 3.6,
                  delay,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                style={{ willChange: "transform, opacity" }}
                className="absolute h-48 w-48 rounded-full border border-white/40"
              />
            ))}

            {/* Center disc — sin backdrop-blur (caro) ni rotación infinita */}
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
              <div className="absolute inset-2 rounded-full border border-dashed border-white/30" />
              <Fingerprint
                className="h-24 w-24 text-white"
                aria-hidden="true"
              />
            </div>

            {/* Floating data chips */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="absolute -left-4 top-12 rounded-xl bg-background/95 px-3 py-2 text-xs font-mono shadow-2xl backdrop-blur-sm md:-left-12"
            >
              <span className="text-success">●</span>{" "}
              <span className="text-foreground/80">Match: 0.91</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="absolute -right-4 bottom-16 rounded-xl bg-background/95 px-3 py-2 text-xs font-mono shadow-2xl backdrop-blur-sm md:-right-8"
            >
              <span className="text-primary">●</span>{" "}
              <span className="text-foreground/80">Dra. Carla</span>
            </motion.div>
          </motion.div>

          {/* Copy */}
          <div className="text-white">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Solo en Psiconex
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-display mt-5 text-balance"
            >
              Tu voz, tu firma clínica
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-5 text-lg text-white/85"
            >
              Otros transcriptores adivinan quién habla. Nosotros lo sabemos. Nuestra
              tecnología biométrica aprende tu voz una vez y nunca te confunde
              con tu paciente — ni siquiera cuando el audio es difícil.
            </motion.p>

            <ul className="mt-8 space-y-3">
              {BENEFITS.map((b, i) => (
                <motion.li
                  key={b}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 + i * 0.07, duration: 0.5 }}
                  className="flex items-start gap-3 text-sm text-white/95"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {b}
                </motion.li>
              ))}
            </ul>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-10"
            >
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-white text-primary hover:bg-white/90"
              >
                <Link href={ROUTES.register}>
                  Probar la biometría
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
