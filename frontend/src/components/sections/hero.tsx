"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TranscriptPreview } from "@/components/sections/transcript-preview"
import { ROUTES } from "@/lib/config"

export function HeroSection() {
  return (
    <section
      aria-label="Presentación de Psiconex"
      className="section-perf relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 lg:pt-24 lg:pb-32"
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(var(--primary)/0.15),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.025] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Floating orbs — solo dos, blur moderado, animation con will-change */}
        <div
          className="orb animate-float-slow left-[-8%] top-24 size-[22rem] bg-primary/35"
          style={{ animationDelay: "-2s" }}
        />
        <div
          className="orb animate-float-slow right-[-6%] top-44 size-[26rem] bg-[hsl(280_75%_64%)]/30"
          style={{ animationDelay: "-8s" }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* Left: copy + CTAs */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Hecho para psicólogos clínicos
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="text-display mt-6 text-balance text-foreground"
            >
              Escucha al paciente,{" "}
              <span className="gradient-primary-text">no a tu cuaderno</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground lg:mx-0"
            >
              Psiconex transcribe tus sesiones, distingue quién habla, busca en el
              historial y redacta informes clínicos. Tú haces clínica; nosotros, la
              burocracia.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            >
              <Button asChild size="xl" className="w-full sm:w-auto">
                <Link href={ROUTES.register}>
                  Probar gratis 14 días
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="ghost"
                className="w-full sm:w-auto"
              >
                <Link href="#demo">
                  <PlayCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                  Ver demo de 90 segundos
                </Link>
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 text-xs text-muted-foreground"
            >
              Sin tarjeta · Datos cifrados · Cancela cuando quieras
            </motion.p>
          </div>

          {/* Right: transcript preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-[hsl(280_75%_64%)/0.15] blur-2xl" />
            <TranscriptPreview />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
