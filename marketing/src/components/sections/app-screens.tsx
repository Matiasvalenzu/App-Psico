import {
  CalendarDays,
  ClipboardList,
  FileDown,
  Mic,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/* Pantallas de la app con datos ficticios para la secuencia del hero.
 * Imitan el estilo de Psiconex (blanco, acento azul, badges tipo píldora). */

type Nav = "pacientes" | "agenda" | "boletas"

const NAV_ITEMS: { key: Nav | "tests" | "voz"; icon: typeof Users; label: string }[] = [
  { key: "pacientes", icon: Users, label: "Pacientes" },
  { key: "agenda", icon: CalendarDays, label: "Agenda" },
  { key: "tests", icon: ClipboardList, label: "Tests" },
  { key: "voz", icon: Mic, label: "Voz" },
  { key: "boletas", icon: Receipt, label: "Boletas" },
]

function Pill({ tone, children }: { tone: "blue" | "green" | "amber" | "violet" | "slate"; children: ReactNode }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-600",
  }
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>
      {children}
    </span>
  )
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white p-3", className)}>{children}</div>
}

export function AppFrame({ nav, crumb, children }: { nav: Nav; crumb: string; children: ReactNode }) {
  return (
    <div className="flex h-full bg-slate-50 text-left text-slate-800">
      <aside className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3 sm:flex">
        <span className="mb-2 grid size-7 place-items-center rounded-lg bg-blue-600 text-[11px] font-bold text-white">P</span>
        {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
          <span
            key={key}
            title={label}
            className={cn(
              "grid size-8 place-items-center rounded-md",
              key === nav ? "bg-blue-50 text-blue-600" : "text-slate-400",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <span className="truncate text-[11px] font-medium text-slate-500">{crumb}</span>
          <Pill tone="slate">Ejemplo ficticio</Pill>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">{children}</div>
      </div>
    </div>
  )
}

const DIAS = ["Lun 12", "Mar 13", "Mié 14", "Jue 15", "Vie 16"]
const HORAS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]
const CITAS = [
  { dia: 1, hora: 1, nombre: "Diego Soto" },
  { dia: 2, hora: 2, nombre: "Ana Rojas" },
  { dia: 3, hora: 6, nombre: "Camila Pérez" },
  { dia: 4, hora: 1, nombre: "Diego Soto" },
]

export function AgendaScreen() {
  return (
    <AppFrame nav="agenda" crumb="Agenda">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Semana del 12 al 16 de octubre</p>
            <p className="text-[11px] text-slate-500">4 sesiones programadas</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">
            <Plus className="size-3" aria-hidden /> Crear cita
          </span>
        </div>
        <Card className="min-h-0 flex-1 overflow-hidden p-2">
          <div
            className="grid h-full text-[10px]"
            style={{ gridTemplateColumns: "2.4rem repeat(5, minmax(0, 1fr))", gridTemplateRows: `auto repeat(${HORAS.length}, minmax(0, 1fr))` }}
          >
            <span />
            {DIAS.map((d, i) => (
              <span
                key={d}
                className={cn("pb-1 text-center font-semibold", i === 2 ? "text-blue-600" : "text-slate-500")}
              >
                {d}
              </span>
            ))}
            {HORAS.map((h, r) => (
              <span key={h} className="border-t border-slate-100 pr-1 pt-0.5 text-slate-400" style={{ gridColumn: 1, gridRow: r + 2 }}>
                {h}
              </span>
            ))}
            {HORAS.map((h, r) =>
              DIAS.map((d, c) => (
                <span
                  key={`${h}-${d}`}
                  className={cn("border-l border-t border-slate-100", c === 2 && "bg-blue-50/40")}
                  style={{ gridColumn: c + 2, gridRow: r + 2 }}
                />
              )),
            )}
            {CITAS.map((cita) => (
              <span
                key={`${cita.dia}-${cita.hora}`}
                className="z-10 m-0.5 overflow-hidden rounded-md border-l-2 border-blue-600 bg-blue-100 px-1 py-0.5 leading-tight text-blue-800"
                style={{ gridColumn: cita.dia + 2, gridRow: cita.hora + 2 }}
              >
                <span className="block font-semibold">{HORAS[cita.hora]}</span>
                <span className="block truncate">{cita.nombre}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </AppFrame>
  )
}

const FICHA_TABS = ["Resumen", "Sesiones", "Documentos", "Asistente IA", "Cobros"]

export function FichaScreen() {
  return (
    <AppFrame nav="pacientes" crumb="Pacientes / Ana Rojas">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">AR</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              Ana Rojas <Pill tone="green">Activo</Pill>
            </p>
            <p className="text-[11px] text-slate-500">3 sesiones · última el 14/10</p>
          </div>
          <span className="hidden rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white sm:inline-flex">
            Nueva sesión
          </span>
        </div>
        <div className="flex gap-3 overflow-hidden border-b border-slate-200 text-[11px]">
          {FICHA_TABS.map((t, i) => (
            <span
              key={t}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 pb-1.5",
                i === 0 ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500",
              )}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="grid min-h-0 gap-3 sm:grid-cols-[1.4fr_1fr]">
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Motivo de consulta</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              Estrés por la carga laboral y dificultad para desconectarse.
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Objetivo</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">Recuperar pausas durante la jornada.</p>
          </Card>
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Contacto</p>
            <p className="mt-1 text-xs text-slate-700">+56 9 0000 0001</p>
            <p className="truncate text-xs text-slate-700">ana.ejemplo@example.com</p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Consentimiento</p>
            <p className="mt-1">
              <Pill tone="green">Firmado</Pill>
            </p>
          </Card>
        </div>
      </div>
    </AppFrame>
  )
}

const DIALOGO = [
  { t: "00:12", quien: "Psicóloga", texto: "¿Cómo te fue esta semana con las pausas que conversamos?" },
  { t: "00:19", quien: "Paciente", texto: "Mejor. Logré cortar a la hora de almuerzo casi todos los días." },
  { t: "00:31", quien: "Psicóloga", texto: "¿Qué cambió los días en que sí pudiste parar?" },
  { t: "00:38", quien: "Paciente", texto: "Dejé el celular en el escritorio y salí a caminar un rato." },
]

export function TranscripcionScreen() {
  return (
    <AppFrame nav="pacientes" crumb="Ana Rojas / Sesión 3">
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Transcripción · 14/10/2026</p>
          <div className="flex gap-1.5">
            <Pill tone="blue">Psicóloga</Pill>
            <Pill tone="violet">Paciente</Pill>
          </div>
        </div>
        <Card className="min-h-0 flex-1 space-y-2.5 overflow-hidden">
          {DIALOGO.map((l) => (
            <div key={l.t} className="flex gap-2 text-xs leading-relaxed">
              <span className="w-9 shrink-0 pt-px font-mono text-[10px] text-slate-400">{l.t}</span>
              <p className="min-w-0">
                <span className={cn("font-semibold", l.quien === "Psicóloga" ? "text-blue-700" : "text-violet-700")}>
                  {l.quien}:
                </span>{" "}
                <span className="text-slate-700">{l.texto}</span>
              </p>
            </div>
          ))}
        </Card>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Pencil className="size-3" aria-hidden /> Puedes corregir cualquier línea.
        </p>
      </div>
    </AppFrame>
  )
}

const INFORME = [
  { label: "Motivo", text: "Estrés por la carga laboral y dificultad para desconectarse." },
  { label: "Evolución", text: "Menos tensión que en la sesión anterior; retoma una rutina de pausas." },
  { label: "Puntos clave", text: "Reconoce cuándo aparece la tensión y qué la dispara." },
  { label: "Próxima sesión", text: "Revisar la práctica de pausas y fijar un objetivo para la semana." },
]

export function InformeScreen() {
  return (
    <AppFrame nav="pacientes" crumb="Ana Rojas / Asistente IA">
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Informe de sesión</p>
          <Pill tone="amber">Borrador · revisar y editar</Pill>
        </div>
        <Card className="min-h-0 flex-1 space-y-2 overflow-hidden">
          {INFORME.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</p>
              <p className="text-xs leading-relaxed text-slate-700">{f.text}</p>
            </div>
          ))}
        </Card>
        <div className="flex items-center gap-2">
          {["PDF", "Word"].map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
            >
              <FileDown className="size-3" aria-hidden /> {f}
            </span>
          ))}
          <span className="ml-auto hidden text-[11px] text-slate-500 sm:inline">Lo editas antes de firmar.</span>
        </div>
      </div>
    </AppFrame>
  )
}

const COBROS = [
  { fecha: "07/10", pago: "Pagado", medio: "Transferencia", boleta: "Emitida" },
  { fecha: "14/10", pago: "Pendiente", medio: "—", boleta: "Sin boleta" },
]

export function CobrosScreen() {
  return (
    <AppFrame nav="pacientes" crumb="Ana Rojas / Cobros">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Cobros</p>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">
            <Plus className="size-3" aria-hidden /> Registrar cobro
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pagado este mes</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">$35.000</p>
          </Card>
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pendiente este mes</p>
            <p className="mt-1 text-lg font-bold text-amber-700">$35.000</p>
          </Card>
        </div>
        <Card className="p-0">
          <div className="grid grid-cols-[3rem_1fr_auto] gap-x-3 border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Sesión</span>
            <span>Monto</span>
            <span>Estado</span>
          </div>
          {COBROS.map((c) => (
            <div
              key={c.fecha}
              className="grid grid-cols-[3rem_1fr_auto] items-center gap-x-3 border-b border-slate-100 px-3 py-2 text-xs last:border-0"
            >
              <span className="text-slate-500">{c.fecha}</span>
              <span className="min-w-0">
                <span className="font-semibold text-slate-800">$35.000</span>
                <span className="ml-1.5 hidden text-[11px] text-slate-500 sm:inline">{c.medio}</span>
              </span>
              <span className="flex gap-1">
                <Pill tone={c.pago === "Pagado" ? "green" : "amber"}>{c.pago}</Pill>
                <Pill tone={c.boleta === "Emitida" ? "blue" : "slate"}>{c.boleta}</Pill>
              </span>
            </div>
          ))}
        </Card>
      </div>
    </AppFrame>
  )
}

export function BoletasScreen() {
  return (
    <AppFrame nav="boletas" crumb="Boletas de honorarios">
      <div className="flex h-full flex-col justify-center">
        <Card className="mx-auto w-full max-w-sm space-y-3 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Boleta de honorarios</p>
            <Pill tone="amber">Por emitir</Pill>
          </div>
          <p className="text-[11px] text-slate-500">Camila Pérez · sesión del 15/10/2026</p>
          <div className="space-y-1.5 border-y border-slate-100 py-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Monto bruto</span>
              <span className="font-semibold text-slate-800">$35.000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Retención estimada (15,25 %)</span>
              <span className="font-semibold text-slate-800">$5.338</span>
            </div>
          </div>
          <span className="flex w-full items-center justify-center rounded-md bg-blue-600 py-2 text-xs font-semibold text-white">
            Emitir en el SII
          </span>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden /> Sin entregar tu clave del SII
          </p>
        </Card>
      </div>
    </AppFrame>
  )
}
