"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Caveat } from "next/font/google"
import { AudioLines, FileText, Mic, RotateCcw, TrendingUp } from "lucide-react"
import { SectionHeading } from "@/components/sections/section-heading"
import { cn } from "@/lib/utils"
import styles from "./one-session.module.css"

const caveat = Caveat({ subsets: ["latin"], weight: ["600"], display: "swap" })

// 24 alturas relativas fijas (0–1); sin Math.random para no romper la hidratación
const WAVE = [
  0.35, 0.6, 0.85, 0.5, 0.95, 0.7, 0.4, 0.8, 1, 0.65, 0.45, 0.9, 0.6, 0.75, 0.5,
  0.95, 0.7, 0.4, 0.85, 0.55, 0.8, 0.45, 0.65, 0.3,
]

const FICHA = [
  { label: "Motivo", text: "Estrés por la carga laboral y dificultad para desconectarse." },
  { label: "Evolución", text: "Menos tensión que en la sesión anterior; retoma una rutina de pausas." },
  { label: "Puntos clave", text: "Reconoce cuándo aparece la tensión y qué la dispara." },
  { label: "Próxima sesión", text: "Revisar la práctica de pausas y fijar un objetivo para la semana." },
]

const RESULTADOS = [
  {
    icon: AudioLines,
    title: "Transcripción con voces separadas",
    body: "Psicólogo y paciente, con marcas de tiempo. Puedes editarla.",
  },
  {
    icon: TrendingUp,
    title: "Resumen y evolución",
    body: "Los pides en el chat con IA, a partir del historial del paciente.",
  },
  {
    icon: FileText,
    title: "Informe para revisar y firmar",
    body: "Descárgalo en PDF o Word y edítalo antes de firmarlo.",
  },
]

// Demora y duración (s) de cada elemento animado
const t = (d: number, dur?: number) =>
  ({ "--d": `${d}s`, ...(dur ? { "--dur": `${dur}s` } : {}) }) as CSSProperties

const INK = "text-[hsl(var(--os-ink))]"

function Arrow({ delay }: { delay: number }) {
  return (
    <div className="flex items-center justify-center text-primary" aria-hidden="true">
      <svg
        viewBox="0 0 72 24"
        width="72"
        height="24"
        focusable="false"
        className={cn(styles.item, styles.wipeX, "hidden lg:block")}
        style={t(delay)}
        data-os-item
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12 H56" strokeDasharray="0.1 7" />
        <path d="M54 5 L66 12 L54 19" />
      </svg>
      <svg
        viewBox="0 0 24 56"
        width="24"
        height="56"
        focusable="false"
        className={cn(styles.item, styles.wipeY, "lg:hidden")}
        style={t(delay)}
        data-os-item
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 4 V42" strokeDasharray="0.1 7" />
        <path d="M5 40 L12 52 L19 40" />
      </svg>
    </div>
  )
}

function SessionIllustration() {
  const p = "hsl(255 80% 56%)"
  const m = "hsl(280 75% 64%)"
  return (
    <svg viewBox="0 0 320 200" aria-hidden="true" focusable="false" className="h-full w-full">
      <ellipse cx="92" cy="150" rx="78" ry="34" fill={p} fillOpacity=".10" />
      <ellipse cx="236" cy="152" rx="74" ry="32" fill={m} fillOpacity=".12" />
      <path d="M24 176 H296" stroke={p} strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 176 V120 Q40 104 56 104 H100 Q116 104 116 120 V176 Z" fill={p} fillOpacity=".18" />
      <circle cx="80" cy="76" r="17" fill={p} fillOpacity=".85" />
      <path d="M52 150 Q52 104 80 104 Q108 104 108 150 V176 H52 Z" fill={p} fillOpacity=".70" />
      <path d="M204 176 V120 Q204 104 220 104 H264 Q280 104 280 120 V176 Z" fill={m} fillOpacity=".20" />
      <circle cx="240" cy="78" r="16" fill={m} fillOpacity=".90" />
      <path d="M214 150 Q214 106 240 106 Q266 106 266 150 V176 H214 Z" fill={m} fillOpacity=".72" />
      <g fill="#fff" stroke={p} strokeOpacity=".35" strokeWidth="1.5">
        <path d="M110 40 h40 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-26 l-10 8 v-8 h-4 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8z" />
        <path d="M176 28 h40 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-4 v8 l-10 -8 h-26 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8z" />
      </g>
      <g fill={p} fillOpacity=".55">
        <circle cx="122" cy="54" r="2.5" />
        <circle cx="132" cy="54" r="2.5" />
        <circle cx="142" cy="54" r="2.5" />
      </g>
      <g fill={m} fillOpacity=".8">
        <circle cx="188" cy="42" r="2.5" />
        <circle cx="198" cy="42" r="2.5" />
        <circle cx="208" cy="42" r="2.5" />
      </g>
    </svg>
  )
}

export function OneSessionSection() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"idle" | "playing">("idle")
  const [run, setRun] = useState(0)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Con reduced-motion el CSS ya muestra el estado final
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("playing")
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const replay = () => {
    // key distinto => remonta el escenario => reinicia las animaciones CSS
    setRun((r) => r + 1)
    setState("playing")
  }

  return (
    <section
      id="una-sesion"
      aria-label="Ejemplo ficticio: de una sesión a una ficha para revisar"
      className="relative py-20 md:py-28 lg:py-32"
    >
      <noscript>
        <style>{"[data-os-item]{opacity:1!important;transform:none!important;clip-path:none!important}"}</style>
      </noscript>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Un ejemplo del flujo"
          title={
            <>
              Una sesión de 50 minutos,{" "}
              <span className="gradient-primary-text">una ficha para revisar</span>
            </>
          }
          description="Psiconex transcribe el audio, separa las voces y te deja una base ordenada para tu ficha y tus informes. La IA propone; tú revisas y decides."
        />

        <div ref={rootRef} data-state={state} className={styles.root}>
          <div
            className={cn(
              styles.panel,
              "relative mt-12 overflow-hidden rounded-3xl border border-primary/15 p-5 shadow-xl shadow-primary/10 sm:p-8 md:mt-16 xl:p-12"
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                  INK
                )}
              >
                Ejemplo ficticio
              </span>
              <button
                type="button"
                onClick={replay}
                aria-label="Repetir la animación del ejemplo"
                title="Repetir la animación del ejemplo"
                className="inline-flex size-11 items-center justify-center rounded-full border border-primary/20 bg-white/80 outline-none transition-colors duration-150 hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hidden"
              >
                <RotateCcw className={cn("size-[18px]", INK)} aria-hidden="true" />
              </button>
            </div>

            <div key={run}>
              <div className="mt-6 flex flex-col items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_72px_minmax(0,1.15fr)_72px_minmax(0,1fr)] lg:items-center lg:gap-0 xl:mt-8">
                {/* Columna 1 — audio */}
                <div
                  className={cn(
                    styles.item,
                    styles.fadeUp,
                    "w-full max-w-md rounded-2xl border border-white/80 bg-white/70 p-4 lg:max-w-none"
                  )}
                  style={t(0)}
                  data-os-item
                >
                  <div
                    role="img"
                    aria-label="Ilustración: un psicólogo y un paciente conversando en una sesión"
                    className="mx-auto aspect-[16/10] w-full max-w-[320px]"
                  >
                    <SessionIllustration />
                  </div>
                  <div
                    className="mx-auto flex h-16 w-full max-w-[220px] items-center justify-between"
                    aria-hidden="true"
                  >
                    {WAVE.map((h, i) => (
                      <span
                        key={i}
                        className={styles.bar}
                        style={{ "--h": h, "--i": i } as CSSProperties}
                      />
                    ))}
                  </div>
                  <div
                    className={cn(
                      styles.mic,
                      "mx-auto mt-2 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    )}
                    aria-hidden="true"
                  >
                    <Mic className="size-5" />
                  </div>
                  <p className="mt-3 text-center text-[13px] font-medium text-muted-foreground">
                    Audio de la sesión · 50 min
                  </p>
                </div>

                <Arrow delay={2.6} />

                {/* Columna 2 — ficha de sesión (borrador) */}
                <div
                  className={cn(
                    styles.item,
                    styles.fadeUp,
                    "w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 shadow-lg shadow-primary/10 lg:max-w-none"
                  )}
                  style={t(3, 0.45)}
                  data-os-item
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Ficha de sesión</h3>
                      <p className="text-[13px] text-muted-foreground">Paciente de ejemplo · Sesión 4</p>
                    </div>
                    <span
                      className={cn(
                        styles.item,
                        styles.pop,
                        "whitespace-nowrap rounded-full bg-warning/16 px-2.5 py-1 text-xs font-semibold text-[hsl(var(--os-amber))]"
                      )}
                      style={t(5.5)}
                      data-os-item
                    >
                      Borrador para revisar
                    </span>
                  </div>
                  <dl className="mt-4 border-t border-border/70">
                    {FICHA.map((row, i) => (
                      <div
                        key={row.label}
                        className={cn(
                          styles.item,
                          styles.wipeX,
                          "py-3",
                          i < FICHA.length - 1 && "border-b border-border/50"
                        )}
                        style={t(3.5 + i * 0.5)}
                        data-os-item
                      >
                        <dt className={cn("text-xs font-semibold uppercase tracking-wider", INK)}>
                          {row.label}
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">{row.text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <Arrow delay={5.7} />

                {/* Columna 3 — resultados reales */}
                <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none">
                  {RESULTADOS.map((r, i) => (
                    <div
                      key={r.title}
                      className={cn(
                        styles.item,
                        styles.slideIn,
                        "flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-md shadow-primary/5"
                      )}
                      style={t(6.1 + i * 0.3)}
                      data-os-item
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <r.icon className={cn("size-[18px]", INK)} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                        <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">{r.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={cn(styles.item, styles.fadeUp, "mt-8 text-center xl:mt-10")}
                style={t(7.2, 0.6)}
                data-os-item
              >
                <p
                  className={cn(
                    caveat.className,
                    "text-[32px] leading-9 text-[hsl(var(--os-hand))] md:text-[40px] md:leading-[44px]"
                  )}
                >
                  Tú revisas, tú firmas.
                </p>
                <svg
                  viewBox="0 0 220 12"
                  aria-hidden="true"
                  focusable="false"
                  className="mx-auto mt-1 w-40 md:w-[190px]"
                >
                  <path
                    className={styles.underline}
                    pathLength="1"
                    d="M3 8 C 40 2, 90 12, 140 5 S 200 4, 217 7"
                    fill="none"
                    stroke="hsl(280 75% 64%)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <p
                className={cn(
                  styles.item,
                  styles.fadeIn,
                  "mt-3 text-center text-[13px] text-muted-foreground"
                )}
                style={t(7.6)}
                data-os-item
              >
                Ejemplo ficticio. No son datos de pacientes reales.
              </p>
            </div>
          </div>

          <p
            key={run}
            className={cn(
              styles.item,
              styles.fadeIn,
              "mx-auto mt-6 max-w-2xl text-balance text-center text-sm text-muted-foreground"
            )}
            style={t(7.6)}
            data-os-item
          >
            La transcripción se genera al procesar el audio. El resumen, la evolución y el informe
            los generas tú desde el chat con IA del paciente, a partir de su historial. Siempre son
            borradores: tú los revisas y los editas.
          </p>
        </div>
      </div>
    </section>
  )
}
