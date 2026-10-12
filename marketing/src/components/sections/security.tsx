"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Lock, Server, Eye, FileKey, AudioLines, Download } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"
import { SITE } from "@/lib/config"

const PILLARS = [
  {
    icon: Lock,
    title: "Cifrado en tránsito y en la base de datos",
    body: "La información viaja cifrada mediante HTTPS. Diagnóstico, medicación, notas privadas, notas de sesión y firmas se guardan además cifrados.",
    chip: "Cifrado",
  },
  {
    icon: AudioLines,
    title: "El audio no se queda",
    body: "Eliminamos el audio de la sesión en cuanto termina la transcripción. Si el proceso falla, lo conservamos 7 días para reintentar y luego se borra.",
    chip: "Audio efímero",
  },
  {
    icon: Server,
    title: "Qué procesamos nosotros y qué no",
    body: "La transcripción la hace nuestro servidor. Para separar las voces el audio va a Deepgram, y la IA de chat e informes recibe el texto sin el nombre del paciente.",
    chip: "Transparencia",
  },
  {
    icon: Eye,
    title: "Google aislado de la IA",
    body: "Los datos obtenidos desde Google Calendar nunca se comparten ni se envían a servicios externos de inteligencia artificial.",
    chip: "Datos segregados",
  },
  {
    icon: FileKey,
    title: "Consentimiento informado",
    body: "Plantilla editable que el paciente firma de forma electrónica mediante un enlace, y que nombra a cada proveedor. Te avisamos si un paciente no tiene consentimiento registrado.",
    chip: "Plantilla editable",
  },
  {
    icon: Download,
    title: "Tus datos son tuyos",
    body: "Descarga todo en un ZIP (JSON y PDF), revisa el registro de accesos de los últimos 12 meses y elimina tu cuenta desde la app cuando quieras.",
    chip: "Control",
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
              Qué pasa con tus datos,{" "}
              <span className="gradient-primary-text">sin letra chica</span>
            </>
          }
          description="Trabajas con información muy sensible. Aquí te contamos qué procesamos en nuestro servidor, qué servicios externos intervienen y qué decides tú."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Disponible hoy
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          ¿Tienes preguntas sobre cómo tratamos los datos? Escríbenos a{" "}
          <a className="text-primary underline underline-offset-4" href={`mailto:${SITE.email}`}>{SITE.email}</a>{" "}
          o revisa nuestra{" "}
          <Link className="text-primary underline underline-offset-4" href="/privacidad">política de privacidad</Link>.
        </p>
      </div>
    </section>
  )
}
