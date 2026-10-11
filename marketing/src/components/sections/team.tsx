"use client"

import Image from "next/image"
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

/** URL pública de LinkedIn de Matías. Vacía = no se muestra el botón. */
export const FOUNDER_LINKEDIN_URL = ""

const CONTACT_EMAIL = "matias@datnexia.com"

type TeamMember = {
  name: string
  role: string
  bio: string
  photo: string
  email?: string
}

const TEAM: TeamMember[] = [
  {
    name: "Matías Valenzuela",
    role: "Fundador · Director Ejecutivo",
    bio: "Fundó Psiconex y la construye conversando con psicólogos y psiquiatras en Chile, para que la herramienta responda a cómo se trabaja en consulta. La IA apoya; el criterio clínico sigue siendo del profesional.",
    photo: "/equipo-matias.jpg",
    email: CONTACT_EMAIL,
  },
  {
    name: "Camila Valenzuela",
    role: "Fundadora · Directora de Administración y Finanzas",
    bio: "Más de 10 años en gestión de proyectos, coordinación institucional y soluciones operativas y digitales, liderando equipos en el sector público y privado. En Psiconex cuida la administración y las finanzas del proyecto.",
    photo: "/equipo-camila.jpg",
  },
  {
    name: "María Camila Barraza",
    role: "Directora de Comunicaciones y Marketing",
    bio: "Publicista de la Universidad del Norte, con experiencia en marketing, gestión de clientes y coordinación de proyectos en multinacionales y consultoras. En Psiconex lidera campañas, web y redes sociales.",
    photo: "/equipo-maria-camila.jpg",
  },
  {
    name: "Paulo Valenzuela",
    role: "Director de Tecnología y Desarrollo",
    bio: "Más de 25 años en tecnologías de la información, liderando software, infraestructura crítica y sistemas de comunicación, incluida la implementación de una ficha clínica electrónica. En Psiconex lidera la tecnología.",
    photo: "/equipo-paulo.jpg",
  },
  {
    name: "Lina Barraza",
    role: "Psicóloga clínica · Colaboradora de producto",
    bio: "Psicóloga clínica con enfoque cognitivo-conductual, centrada en la regulación emocional. Aporta la mirada psicológica a las características y definiciones de Psiconex, y usa la plataforma con frecuencia en su práctica.",
    photo: "/equipo-lina.jpg",
  },
]

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
          description="Psiconex lo construye un equipo pequeño, con una invitación abierta a quienes ejercen. La inteligencia artificial apoya al psicólogo; nunca lo reemplaza."
        />

        <ul className="mx-auto mt-16 grid max-w-5xl gap-5 md:grid-cols-2">
          {TEAM.map((member, i) => (
            <motion.li
              key={member.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.5,
                delay: (i % 2) * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="card-premium flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-start md:last:odd:col-span-2 md:last:odd:w-[calc(50%-0.625rem)] md:last:odd:justify-self-center"
            >
              <Image
                src={member.photo}
                alt={`Foto de ${member.name}`}
                width={600}
                height={600}
                loading="lazy"
                unoptimized
                className="size-28 shrink-0 rounded-2xl object-cover ring-2 ring-primary/20 sm:size-32"
              />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {member.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-primary">
                  {member.role}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {member.bio}
                </p>
                {member.email || (member.name === "Matías Valenzuela" && FOUNDER_LINKEDIN_URL) ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {member.email ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={`mailto:${member.email}`}>
                          <Mail aria-hidden="true" />
                          {member.email}
                        </a>
                      </Button>
                    ) : null}
                    {member.name === "Matías Valenzuela" && FOUNDER_LINKEDIN_URL ? (
                      <Button asChild variant="ghost" size="sm">
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
                ) : null}
              </div>
            </motion.li>
          ))}
        </ul>

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
