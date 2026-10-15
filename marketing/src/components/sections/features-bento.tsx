"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react"
import {
  Calendar,
  Video,
  AudioLines,
  ClipboardList,
  Receipt,
  ShieldCheck,
  Lock,
  Download,
  UserCheck,
  Sparkles,
  Trash2,
} from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"
import { cn } from "@/lib/utils"

/*
 * Sección "Funciones": el flujo clínico como recorrido vertical
 * (agenda → atención → transcripción → análisis → cobro).
 * Línea que se dibuja con el scroll, ilustraciones CSS/SVG livianas
 * y respeto de prefers-reduced-motion.
 */

interface Step {
  n: string
  verb: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  items: { title: string; body: string; badge?: string }[]
  visual: React.ReactNode
}

const STEPS: Step[] = [
  {
    n: "01",
    verb: "Agendas",
    icon: Calendar,
    items: [
      {
        title: "Agenda con Google Calendar",
        body: "Sincroniza tus citas con Google Calendar si conectas tu cuenta. Tus pacientes reciben un recordatorio por correo 24 horas antes, sin datos clínicos.",
      },
    ],
    visual: <CalendarVisual />,
  },
  {
    n: "02",
    verb: "Atiendes",
    icon: Video,
    items: [
      {
        title: "Videollamada propia o sesión presencial",
        body: "Envías un enlace y el paciente entra desde el navegador, sin crear cuenta ni instalar nada. Se graba solo el audio, con tu voz y la del paciente en canales separados.",
        badge: "Integrada",
      },
    ],
    visual: <CallVisual />,
  },
  {
    n: "03",
    verb: "Transcribes",
    icon: AudioLines,
    items: [
      {
        title: "Transcripción y separación de voces",
        body: "Separa la voz del psicólogo y la del paciente, y entrega la sesión con marcas de tiempo, lista para que la revises.",
      },
      {
        title: "Reconocimiento de tu voz",
        body: "Registras tu voz una vez. Después Psiconex te reconoce y distingue quién habla en cada sesión.",
      },
    ],
    visual: <WaveVisual />,
  },
  {
    n: "04",
    verb: "Analizas",
    icon: ClipboardList,
    items: [
      {
        title: "Tests y escalas clínicas",
        body: "Test de Creencias Ellis, Rueda de la Vida y escalas PHQ-9, GAD-7, DASS-21 y Rosenberg: se puntúan automáticamente y las escalas muestran su trayectoria.",
      },
      {
        title: "Chat con el historial del paciente",
        body: "Pregunta '¿qué dijo en marzo sobre su madre?' y el chat busca en sus sesiones y te muestra los fragmentos de donde sale la respuesta.",
      },
      {
        title: "Resúmenes de sesión y evolución",
        body: "Resúmenes de sesión y de evolución generados con IA a partir del historial del paciente. Tú los revisas y editas.",
      },
      {
        title: "Brief e informes con IA",
        body: "Un brief antes de cada sesión y borradores de informe a partir del historial del paciente. Tú los revisas y editas.",
        badge: "Plus",
      },
    ],
    visual: <ChartVisual />,
  },
  {
    n: "05",
    verb: "Cobras",
    icon: Receipt,
    items: [
      {
        title: "Cobros y boletas",
        body: "Emite tu boleta de honorarios ante el Servicio de Impuestos Internos, revisa qué sesiones están pagadas y conoce tu retención, todo junto a tus fichas.",
        badge: "Plus",
      },
    ],
    visual: <ReceiptVisual />,
  },
]

/* ---------- Ilustraciones ---------- */

function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-40 w-full max-w-xs items-center justify-center" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_65%)]" />
      <div className="relative">{children}</div>
    </div>
  )
}

function CalendarVisual() {
  return (
    <VisualFrame>
      <div className="relative w-36 rounded-[1.4rem] bg-background/90 p-3 shadow-xl shadow-primary/15 ring-1 ring-primary/15">
        <div className="mb-2 h-2 w-14 rounded-full bg-gradient-to-r from-primary to-[hsl(280_75%_64%)]" />
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 15 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3.5 rounded-md bg-primary/10",
                i === 7 && "flujo-pulse bg-gradient-to-br from-primary to-[hsl(280_75%_64%)]"
              )}
            />
          ))}
        </div>
        <span className="flujo-float absolute -right-6 -top-4 rounded-full bg-background px-2.5 py-1 text-[10px] font-medium text-primary shadow-md ring-1 ring-primary/20">
          ✉ 24 h antes
        </span>
      </div>
    </VisualFrame>
  )
}

function CallVisual() {
  return (
    <VisualFrame>
      <div className="flex items-center gap-3">
        {["T", "P"].map((l, i) => (
          <div key={l} className="relative flex size-16 items-center justify-center">
            <span
              className="flujo-ring absolute inset-0 rounded-full border-2 border-primary/40"
              style={{ animationDelay: `${i * 1.1}s` }}
            />
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-full text-sm font-semibold text-white shadow-lg",
                i === 0 ? "bg-primary shadow-primary/40" : "bg-[hsl(280_75%_64%)] shadow-[hsl(280_75%_64%)]/40"
              )}
            >
              {l}
            </span>
          </div>
        ))}
      </div>
    </VisualFrame>
  )
}

function WaveVisual() {
  return (
    <VisualFrame>
      <div className="flex h-20 items-center gap-[4px]">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "flujo-bar w-[4px] rounded-full",
              i < 8 || (i >= 14 && i < 17) ? "bg-primary" : "bg-[hsl(280_75%_64%)]"
            )}
            style={{
              height: `${28 + Math.abs(Math.sin(i * 0.8)) * 60}%`,
              animationDelay: `${(i % 7) * 0.12}s`,
            }}
          />
        ))}
      </div>
    </VisualFrame>
  )
}

function ChartVisual() {
  return (
    <VisualFrame>
      <svg viewBox="0 0 160 90" className="w-44 overflow-visible">
        <defs>
          <linearGradient id="flujo-chart" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(var(--primary))" />
            <stop offset="1" stopColor="hsl(280 75% 64%)" />
          </linearGradient>
        </defs>
        {[20, 45, 70].map((y) => (
          <line key={y} x1="0" x2="160" y1={y} y2={y} stroke="hsl(var(--primary) / 0.12)" />
        ))}
        <path
          className="flujo-draw"
          d="M5 20 C 30 25, 40 40, 60 45 S 100 55, 115 66 S 145 72, 155 74"
          fill="none"
          stroke="url(#flujo-chart)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={1}
        />
        {[
          [5, 20],
          [60, 45],
          [115, 66],
          [155, 74],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="4.5" fill="white" stroke="hsl(var(--primary))" strokeWidth="2.5" />
        ))}
      </svg>
    </VisualFrame>
  )
}

function ReceiptVisual() {
  return (
    <VisualFrame>
      <div className="flujo-float relative w-32 rounded-2xl bg-background/95 p-3 shadow-xl shadow-primary/15 ring-1 ring-primary/15">
        <div className="mb-2 h-2 w-12 rounded-full bg-primary/70" />
        {[80, 60, 70].map((w) => (
          <div key={w} className="mb-1.5 h-1.5 rounded-full bg-primary/12" style={{ width: `${w}%` }} />
        ))}
        <div className="mt-3 flex items-center justify-between">
          <span className="h-2 w-10 rounded-full bg-primary/20" />
          <span className="flujo-pop flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] text-xs text-white shadow-md">
            ✓
          </span>
        </div>
      </div>
    </VisualFrame>
  )
}

/* ---------- Sección ---------- */

// Curva suave que serpentea por el centro (coordenadas 0–100 x, 0–1000 y)
const WINDING_PATH =
  "M50 0 C 50 60, 58 100, 58 150 S 42 260, 42 350 S 58 460, 58 550 S 42 660, 42 750 S 50 900, 50 1000"

export function FeaturesBentoSection() {
  const timelineRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 75%", "end 60%"],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const drawn = reduce ? 1 : progress

  return (
    <section
      id="producto"
      aria-label="Funciones de Psiconex"
      className="section-perf relative overflow-hidden py-20 md:py-28 lg:py-32"
    >
      <style>{`
        @keyframes flujo-bar { 0%,100% { transform: scaleY(.45) } 50% { transform: scaleY(1) } }
        @keyframes flujo-ring { 0% { transform: scale(.9); opacity:.7 } 100% { transform: scale(1.6); opacity:0 } }
        @keyframes flujo-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes flujo-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        @keyframes flujo-draw { 0% { stroke-dashoffset: 1 } 60%,100% { stroke-dashoffset: 0 } }
        @keyframes flujo-pop { 0%,70%,100% { transform: scale(1) } 80% { transform: scale(1.18) } }
        .flujo-bar { transform-origin: center; animation: flujo-bar 1.6s ease-in-out infinite }
        .flujo-ring { animation: flujo-ring 2.2s ease-out infinite }
        .flujo-float { animation: flujo-float 4s ease-in-out infinite }
        .flujo-pulse { animation: flujo-pulse 2s ease-in-out infinite }
        .flujo-draw { stroke-dasharray: 1; animation: flujo-draw 4s ease-out infinite }
        .flujo-pop { animation: flujo-pop 3s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .flujo-bar, .flujo-ring, .flujo-float, .flujo-pulse, .flujo-draw, .flujo-pop { animation: none }
          .flujo-draw { stroke-dashoffset: 0 }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden">
        <div className="absolute inset-0 bg-grid mask-radial-fade opacity-50" />
        <div className="glow-blob left-1/4 top-20 size-72 bg-primary/25" />
        <div className="glow-blob right-1/4 top-32 size-80 bg-[hsl(280_75%_64%)]/20" />
      </div>

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Funciones"
          title={
            <>
              De la agenda a la boleta,{" "}
              <span className="gradient-primary-text">sin cambiar de herramienta</span>
            </>
          }
          description="Todo el flujo clínico en un solo lugar, pensado para psicólogos, no para informáticos. Diseñado con clínicos chilenos en ejercicio."
        />

        <div ref={timelineRef} id="como-funciona" className="relative mt-16 scroll-mt-24 md:mt-24">
          {/* Línea móvil: recta, a la izquierda */}
          <div aria-hidden="true" className="absolute bottom-0 left-[1.4rem] top-0 w-[3px] rounded-full bg-primary/10 md:hidden">
            <motion.div
              style={{ scaleY: drawn }}
              className="h-full w-full origin-top rounded-full bg-gradient-to-b from-primary to-[hsl(280_75%_64%)]"
            />
          </div>

          {/* Línea escritorio: curva suave por el centro */}
          <svg
            aria-hidden="true"
            viewBox="0 0 100 1000"
            preserveAspectRatio="none"
            className="absolute inset-y-0 left-1/2 hidden h-full w-40 -translate-x-1/2 md:block"
          >
            <defs>
              <linearGradient id="flujo-line" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="hsl(var(--primary))" />
                <stop offset="1" stopColor="hsl(280 75% 64%)" />
              </linearGradient>
            </defs>
            <path d={WINDING_PATH} fill="none" stroke="hsl(var(--primary) / 0.12)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <motion.path
              d={WINDING_PATH}
              fill="none"
              stroke="url(#flujo-line)"
              strokeWidth="3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: drawn }}
            />
          </svg>

          <ol className="relative space-y-14 md:space-y-10">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              const right = i % 2 === 1
              return (
                <motion.li
                  key={step.n}
                  initial={reduce ? false : { opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="relative grid grid-cols-[3rem_1fr] gap-x-5 md:grid-cols-[1fr_6rem_1fr] md:items-center md:gap-x-8"
                >
                  {/* Nodo */}
                  <div className="relative z-10 row-span-2 flex justify-center md:col-start-2 md:row-span-1 md:row-start-1">
                    <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] text-white shadow-lg shadow-primary/40 ring-8 ring-background md:size-14">
                      <Icon className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
                    </span>
                  </div>

                  {/* Texto */}
                  <div
                    className={cn(
                      "md:row-start-1",
                      right ? "md:col-start-3 md:text-left" : "md:col-start-1 md:text-right"
                    )}
                  >
                    <div className={cn("flex items-baseline gap-3", !right && "md:justify-end")}>
                      <span className="gradient-primary-text text-5xl font-bold leading-none tracking-tight md:text-7xl">
                        {step.n}
                      </span>
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                        {step.verb}
                      </h3>
                    </div>
                    <div className="mt-5 space-y-4">
                      {step.items.map((item) => (
                        <div key={item.title}>
                          <p className={cn("flex flex-wrap items-center gap-2 text-base font-semibold text-foreground", !right && "md:justify-end")}>
                            {item.title}
                            {item.badge && (
                              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                {item.badge}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ilustración */}
                  <div
                    className={cn(
                      "col-start-2 mt-6 flex md:row-start-1 md:mt-0",
                      right ? "md:col-start-1 md:justify-end" : "md:col-start-3 md:justify-start"
                    )}
                  >
                    {step.visual}
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </div>

        {/* Franja de confianza */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-20 flex max-w-4xl flex-col gap-4 rounded-full border border-primary/15 bg-gradient-to-r from-primary/5 via-background to-[hsl(280_75%_64%)]/5 px-6 py-4 max-md:rounded-3xl md:flex-row md:items-center md:justify-between md:px-8"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Cifrado y control de tus datos
          </p>
          <ul className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:gap-6">
            <li className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" aria-hidden />Viaja cifrada mediante HTTPS</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />Datos clínicos sensibles guardados cifrados</li>
            <li className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5 text-primary" aria-hidden />Exportas o eliminas tu cuenta cuando quieras</li>
          </ul>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-3 flex max-w-4xl flex-col gap-3 rounded-full border border-primary/15 bg-gradient-to-r from-[hsl(280_75%_64%)]/5 via-background to-primary/5 px-6 py-4 max-md:rounded-3xl md:flex-row md:items-center md:justify-between md:px-8"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            IA responsable
          </p>
          <ul className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:gap-6">
            <li className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />La IA propone, tú decides: todo es editable</li>
            <li className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-primary" aria-hidden />El audio se elimina en cuanto termina la transcripción</li>
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
