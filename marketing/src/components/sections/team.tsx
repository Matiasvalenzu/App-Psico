"use client"

import { motion } from "motion/react"
import {
  Activity,
  Brain,
  Mail,
  MessagesSquare,
  Shield,
  Stethoscope,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/sections/section-heading"

/** TODO: URL pública de LinkedIn de Matías. Vacía = no se muestra el botón. */
export const FOUNDER_LINKEDIN_URL = ""

/** Reemplazar por "/team/matias.jpg" cuando exista el archivo en public/team/. */
export const FOUNDER_PHOTO_SRC = ""

const CONTACT_EMAIL = "matias@datnexia.com"
const FEEDBACK_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Quiero aportar a Psiconex")}`

const SPECIALTIES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Brain,
    title: "Psicología clínica",
    body: "La práctica cotidiana de evaluación, seguimiento y registro.",
  },
  {
    icon: MessagesSquare,
    title: "Psicoterapia",
    body: "El tiempo de la sesión, no el de las notas después.",
  },
  {
    icon: Stethoscope,
    title: "Psiquiatría",
    body: "Quienes combinan consulta clínica y coordinación de cuidado.",
  },
  {
    icon: Activity,
    title: "Neuropsicología",
    body: "Evaluación, informes y el detalle que no puede perderse.",
  },
]

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessagesSquare,
    title: "El criterio clínico es tuyo",
    body: "La herramienta ordena y sugiere. La decisión terapéutica no sale de la consulta: la tomas tú.",
  },
  {
    icon: Shield,
    title: "Privacidad primero",
    body: "Lo que ocurre en sesión se trata como material clínico, no como contenido para mostrar.",
  },
  {
    icon: Activity,
    title: "Hecho en Chile, en español",
    body: "Pensado para cómo se habla y se trabaja en consulta acá, no traducido de otro mercado.",
  },
]

export function TeamSection() {
  return (
    <section
      id="equipo"
      aria-labelledby="equipo-titulo"
      className="section-perf relative py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Equipo"
          title={
            <span id="equipo-titulo">
              Personas detrás de{" "}
              <span className="gradient-primary-text">la herramienta</span>
            </span>
          }
          description="Psiconex no es un producto anónimo. Hay alguien al otro lado, y una invitación abierta a quienes ejercen."
        />

        <motion.article
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="card-premium mx-auto mt-16 grid max-w-4xl gap-8 rounded-2xl p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center"
        >
          <FounderPortrait />
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              Matías Valenzuela
            </h3>
            <p className="mt-1 text-sm font-medium text-primary">
              Fundador de Psiconex
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Creé Psiconex para devolverle tiempo al psicólogo: el de la
              relación terapéutica, no el de reescribir la sesión. La
              inteligencia artificial puede ordenar, transcribir y recordar
              detalles. No reemplaza tu criterio clínico. Ese sigue siendo
              tuyo, en cada consulta.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={`mailto:${CONTACT_EMAIL}`}>
                  <Mail aria-hidden="true" />
                  matias@datnexia.com
                </a>
              </Button>
              {FOUNDER_LINKEDIN_URL ? (
                <Button asChild variant="ghost">
                  <a
                    href={FOUNDER_LINKEDIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </motion.article>

        <div className="mt-20">
          <h3 className="text-center text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Se construye escuchando la consulta
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Psiconex se construye escuchando a psicólogos, psicoterapeutas,
            psiquiatras y neuropsicólogos de Chile. Si ejerces y quieres
            contar cómo trabajas, tu feedback ayuda a que la herramienta
            sirva en la práctica real.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SPECIALTIES.map((item) => (
              <li key={item.title} className="rounded-xl border border-border bg-card p-5">
                <div className="icon-tile h-11 w-11">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 font-semibold text-foreground">{item.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <a href={FEEDBACK_MAILTO}>Quiero aportar</a>
            </Button>
          </div>
        </div>

        <ul className="mt-20 grid gap-5 md:grid-cols-3">
          {PRINCIPLES.map((item, i) => (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="card-premium rounded-2xl p-6"
            >
              <div className="icon-tile h-11 w-11">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function FounderPortrait() {
  if (FOUNDER_PHOTO_SRC) {
    return (
      <img
        src={FOUNDER_PHOTO_SRC}
        alt="Retrato de Matías Valenzuela, fundador de Psiconex"
        className="size-28 rounded-full object-cover ring-2 ring-primary/20 sm:size-32"
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-2xl font-semibold text-primary-foreground shadow-sm sm:size-32"
    >
      MV
    </div>
  )
}
