"use client"

import { motion } from "motion/react"

export function PainSection() {
  return (
    <section aria-label="Para quién es Psiconex" className="relative py-16 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-3xl px-6 text-center lg:px-8"
      >
        <h2 className="text-display text-balance text-foreground">
          Pensado para cómo trabaja{" "}
          <span className="gradient-primary-text">realmente un psicólogo</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
          Entre una sesión y otra no queda tiempo para escribir, y la ficha espera
          hasta la noche. Psiconex toma el registro mientras atiendes, para que al
          cerrar la consulta te quede poco por hacer.
        </p>
      </motion.div>
    </section>
  )
}
