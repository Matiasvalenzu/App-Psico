"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type TouchEvent } from "react"
import { cn } from "@/lib/utils"
import {
  AgendaScreen,
  BoletasScreen,
  CobrosScreen,
  FichaScreen,
  InformeScreen,
  TranscripcionScreen,
} from "@/components/sections/app-screens"

const SCREENS = [
  { id: "agenda", label: "Agenda", caption: "Tus sesiones de la semana en una vista, con todo listo antes de que entre el paciente.", Screen: AgendaScreen },
  { id: "ficha", label: "Ficha", caption: "La historia de cada paciente ordenada en un solo lugar.", Screen: FichaScreen },
  { id: "transcripcion", label: "Transcripción", caption: "La sesión transcrita, con tu voz y la del paciente separadas.", Screen: TranscripcionScreen },
  { id: "informe", label: "Informe", caption: "Un borrador del informe para que lo revises y lo edites antes de firmarlo.", Screen: InformeScreen },
  { id: "cobros", label: "Cobros", caption: "Revisa qué sesiones están pagadas y cuáles faltan.", Screen: CobrosScreen, plus: true },
  { id: "boletas", label: "Boletas", caption: "Emite tu boleta en un clic, sin entregar tu clave del SII.", Screen: BoletasScreen, plus: true },
]

const INTERVALO_MS = 4500
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION)
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

export function AppSequence({ className }: { className?: string }) {
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  )
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const touchX = useRef<number | null>(null)

  // Reinicia el intervalo cada vez que cambia la pantalla (también tras un clic)
  useEffect(() => {
    if (hover || focus || reducedMotion) return
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((i) => (i + 1) % SCREENS.length)
    }, INTERVALO_MS)
    return () => window.clearInterval(id)
  }, [active, hover, focus, reducedMotion])

  const ir = (i: number, enfocar = false) => {
    const next = (i + SCREENS.length) % SCREENS.length
    setActive(next)
    if (enfocar) tabsRef.current[next]?.focus()
  }

  const onTabKeyDown = (event: KeyboardEvent) => {
    const teclas: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: SCREENS.length - 1,
    }
    if (!(event.key in teclas)) return
    event.preventDefault()
    ir(teclas[event.key], true)
  }

  const onTouchStart = (event: TouchEvent) => {
    touchX.current = event.touches[0].clientX
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (touchX.current === null) return
    const dx = event.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 40) ir(active + (dx < 0 ? 1 : -1))
  }

  const actual = SCREENS[active]

  return (
    <div
      id="demo"
      className={cn("flex scroll-mt-20 flex-col gap-3 lg:h-full", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocus(false)
      }}
    >
      <div
        role="tablist"
        aria-label="Pantallas de Psiconex"
        className="flex flex-wrap justify-center gap-1.5 lg:justify-start"
      >
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabsRef.current[i] = el
            }}
            type="button"
            role="tab"
            id={`demo-tab-${s.id}`}
            aria-selected={i === active}
            aria-controls={`demo-panel-${s.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => ir(i)}
            onKeyDown={onTabKeyDown}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              i === active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        className="relative h-[400px] overflow-hidden rounded-2xl border border-border bg-white shadow-lg shadow-primary/15 lg:h-auto lg:min-h-0 lg:flex-1"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {SCREENS.map(({ id, Screen }, i) => (
          <div
            key={id}
            role="tabpanel"
            id={`demo-panel-${id}`}
            aria-labelledby={`demo-tab-${id}`}
            aria-describedby={i === active ? "demo-caption" : undefined}
            aria-hidden={i !== active}
            inert={i !== active}
            className={cn(
              "absolute inset-0 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
              i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <Screen />
          </div>
        ))}
      </div>

      <p
        id="demo-caption"
        className="flex min-h-[2.5rem] items-start justify-center gap-2 text-center text-sm text-muted-foreground lg:justify-start lg:text-left"
      >
        <span>{actual.caption}</span>
        {actual.plus && (
          <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Plan Plus
          </span>
        )}
      </p>
    </div>
  )
}
