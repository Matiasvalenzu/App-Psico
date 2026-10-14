"use client"

import { motion } from "motion/react"
import { ClipboardList, FileSignature, HeartPulse, LineChart, ShieldAlert } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"
import { cn } from "@/lib/utils"

const TARJETAS = [
  {
    icon: LineChart,
    title: "Escalas validadas con trayectoria",
    body: "PHQ-9, GAD-7, DASS-21 y Rosenberg. Aplícalas en consulta o comparte un enlace para que el paciente responda desde su celular, y mira su evolución con bandas de severidad.",
    badge: "Alerta de riesgo",
    className: "md:col-span-2",
  },
  {
    icon: ShieldAlert,
    title: "Alerta de riesgo aparte del puntaje",
    body: "Si el paciente marca el ítem de ideación del PHQ-9, Psiconex te avisa aunque el puntaje total sea bajo. Tú evalúas y decides.",
  },
  {
    icon: ClipboardList,
    title: "Brief antes de cada sesión",
    body: "Un resumen de un minuto con la última sesión, los cambios en escalas, las tareas y el ánimo para retomar el hilo.",
    badge: "Plus",
  },
  {
    icon: FileSignature,
    title: "Informes para colegio, tribunal y licencia",
    body: "Borradores según el destinatario, con diagnóstico CIE-10, listos para revisar, firmar y exportar a PDF o Word.",
    badge: "Plus",
  },
  {
    icon: HeartPulse,
    title: "Tareas y ánimo entre sesiones",
    body: "Tu paciente marca sus tareas y registra cómo se siente desde un enlace privado. Tú lo ves en su ficha.",
  },
]

const PUNTOS = [17, 15, 12, 9, 6]

function TrayectoriaVisual() {
  const x = (i: number) => 20 + i * 70
  const y = (v: number) => 10 + (1 - v / 27) * 90
  return (
    <svg viewBox="0 0 320 110" className="mt-5 w-full" aria-hidden="true">
      {[
        [0, 4, "#10b981"],
        [5, 9, "#3b82f6"],
        [10, 14, "#f59e0b"],
        [15, 19, "#f97316"],
        [20, 27, "#ef4444"],
      ].map(([a, b, c]) => (
        <rect key={String(c)} x={20} width={280} y={y(Number(b) + 0.5)} height={y(Number(a) - 0.5) - y(Number(b) + 0.5)} fill={String(c)} opacity={0.1} />
      ))}
      <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} points={PUNTOS.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {PUNTOS.map((v, i) => (
        <g key={i}>
          {i === 0 && <circle cx={x(i)} cy={y(v)} r={9} fill="rgba(185,28,28,.22)" />}
          <circle cx={x(i)} cy={y(v)} r={4.5} fill="hsl(var(--primary))" stroke="white" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  )
}

export function ClinicalFollowupSection() {
  return (
    <section id="seguimiento-clinico" aria-label="Seguimiento clínico" className="section-perf relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Seguimiento clínico"
          title={
            <>
              Mide el avance de cada paciente,{" "}
              <span className="gradient-primary-text">no solo lo que pasa en la sesión</span>
            </>
          }
          description="Aplica escalas validadas, sigue su evolución en un gráfico y llega a cada sesión sabiendo dónde quedaron. La IA prepara borradores; tú decides."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TARJETAS.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className={cn("relative rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur", t.className)}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <t.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-semibold">{t.title}</h3>
                {t.badge && <span className="ml-auto rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-medium text-primary">{t.badge}</span>}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              {i === 0 && <TrayectoriaVisual />}
            </motion.div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground">
          Escalas, alerta de riesgo, tareas y ánimo están en todos los planes; el brief y los informes con IA, en el Plan Plus. Las escalas son instrumentos de tamizaje, no diagnósticos. Psiconex no envía mensajes a tus pacientes por su cuenta: tú compartes los enlaces.
        </p>
      </div>
    </section>
  )
}
