"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/config"

export function CTAFinalSection() {
  return (
    <section
      id="cta"
      aria-label="Empieza con Psiconex"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-10 md:p-16 lg:p-20">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 gradient-primary opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(280_75%_64%/0.5),transparent_60%)]" />
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-2xl text-center text-white">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-display text-balance"
            >
              Devuélvete las tardes
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 text-balance text-lg text-white/90"
            >
              14 días gratis. Sin tarjeta de crédito. Cancela cuando quieras.
              Tus primeros 10 informes los hace Psiconex por ti.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button
                asChild
                size="xl"
                variant="secondary"
                className="bg-white text-primary hover:bg-white/90 w-full sm:w-auto"
              >
                <Link href={ROUTES.register}>
                  Crear cuenta gratis
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="ghost"
                className="w-full sm:w-auto text-white hover:bg-white/15 hover:text-white"
              >
                <Link href={ROUTES.login}>Ya tengo cuenta</Link>
              </Button>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-xs text-white/70"
            >
              Datos cifrados · Cumple Ley 19.628 · Servidores en Chile
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  )
}
