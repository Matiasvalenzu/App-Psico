import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  FileDown,
  FileText,
  LayoutList,
  Mail,
  MessageCircle,
  Mic,
  Plus,
  Receipt,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"
import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"

/* Pantallas de la app con datos ficticios para la secuencia del hero.
 * Imitan las vistas reales de Psiconex (capturas en «capturas landing 2»). */

type Nav = "pacientes" | "agenda" | "boletas"

const NAV_SECCIONES: { titulo: string; items: { key: Nav | "tests" | "voz"; icon: typeof Users; label: string }[] }[] = [
  {
    titulo: "Clínica",
    items: [
      { key: "pacientes", icon: Users, label: "Pacientes" },
      { key: "agenda", icon: CalendarDays, label: "Agenda" },
      { key: "tests", icon: ClipboardList, label: "Tests" },
      { key: "voz", icon: Mic, label: "Voz" },
    ],
  },
  {
    titulo: "Cuenta",
    items: [{ key: "boletas", icon: Receipt, label: "Boletas de honorarios" }],
  },
]

function Pill({ tone, children }: { tone: "blue" | "green" | "amber" | "slate"; children: ReactNode }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-600",
  }
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>
      {children}
    </span>
  )
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white p-3", className)}>{children}</div>
}

function Boton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white", className)}>
      {children}
    </span>
  )
}

function AppFrame({ nav, crumb, children }: { nav: Nav; crumb: string; children: ReactNode }) {
  return (
    <div className="flex h-full bg-white text-left">
      <aside className="hidden w-11 shrink-0 flex-col border-r border-slate-200 py-3 sm:flex xl:w-36">
        <div className="mb-3 flex justify-center xl:justify-start xl:px-3">
          <Logo withWordmark={false} className="size-6 xl:hidden" />
          <Logo className="hidden h-6 xl:block" />
        </div>
        {NAV_SECCIONES.map((seccion) => (
          <div key={seccion.titulo} className="mt-2 flex flex-col items-center gap-0.5 px-1.5 xl:items-stretch">
            <p className="hidden px-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 xl:block">
              {seccion.titulo}
            </p>
            {seccion.items.map(({ key, icon: Icon, label }) => (
              <span
                key={key}
                className={cn(
                  "flex items-center gap-2 rounded-lg p-1.5 text-[11px] xl:px-2",
                  key === nav ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="hidden truncate xl:inline">{label}</span>
              </span>
            ))}
          </div>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50/60">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <span className="truncate text-[11px] text-slate-500">
            Psiconex <span className="px-1">/</span>
            <span className="font-medium text-slate-700">{crumb}</span>
          </span>
          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Ejemplo ficticio
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">{children}</div>
      </div>
    </div>
  )
}

const FICHA_TABS = [
  { label: "Resumen", icon: LayoutList },
  { label: "Sesiones", icon: CalendarDays, n: 3 },
  { label: "Documentos", icon: FileText, n: 0 },
  { label: "Asistente IA", icon: Sparkles },
  { label: "Cobros", icon: Receipt },
]

function PacienteShell({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <AppFrame nav="pacientes" crumb="Detalle del Paciente">
      <div className="flex h-full flex-col gap-2.5">
        <Card className="flex items-center gap-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
            AR
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <span className="whitespace-nowrap">Ana Rojas</span> <Pill tone="slate">Activo</Pill>
            </p>
            <p className="text-[11px] text-slate-500">Diseñadora gráfica</p>
          </div>
          <Boton className="hidden sm:inline-flex">
            <Plus className="size-3" aria-hidden /> Nueva sesión
          </Boton>
        </Card>
        <div className="flex gap-3 overflow-hidden border-b border-slate-200 text-[11px]">
          {FICHA_TABS.map(({ label, icon: Icon, n }) => (
            <span
              key={label}
              className={cn(
                "-mb-px flex items-center gap-1 whitespace-nowrap border-b-2 pb-1.5",
                label === tab ? "border-blue-600 font-semibold text-slate-900" : "border-transparent text-slate-500",
              )}
            >
              <Icon className="hidden size-3 sm:block" aria-hidden />
              {label}
              {n !== undefined && <span className="hidden rounded bg-slate-100 px-1 text-[9px] text-slate-500 lg:inline">{n}</span>}
            </span>
          ))}
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </AppFrame>
  )
}

const DIAS = ["LUN 12/10", "MAR 13/10", "MIÉ 14/10", "JUE 15/10", "VIE 16/10"]
const HORAS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
const CITAS = [
  { dia: 3, hora: 1, nombre: "Diego Soto" },
  { dia: 4, hora: 2, nombre: "Ana Rojas" },
  { dia: 3, hora: 6, nombre: "Camila Pérez" },
  { dia: 4, hora: 6, nombre: "Camila Pérez" },
  { dia: 2, hora: 8, nombre: "Ana Rojas" },
]

export function AgendaScreen() {
  return (
    <AppFrame nav="agenda" crumb="Agenda">
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <CalendarDays className="size-4 text-blue-600" aria-hidden /> Agenda
            </p>
            <p className="truncate text-[11px] text-slate-500">5 sesiones programadas esta semana</p>
          </div>
          <Boton>
            <Plus className="size-3" aria-hidden /> Crear cita
          </Boton>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5">Hoy</span>
            <ChevronLeft className="size-3.5 text-slate-500" aria-hidden />
            <ChevronRight className="size-3.5 text-slate-500" aria-hidden />
            <span className="font-semibold">12 – 18 oct 2026</span>
          </span>
          <span className="hidden overflow-hidden rounded-md border border-slate-200 bg-white sm:flex">
            <span className="px-2 py-0.5 text-slate-500">Mes</span>
            <span className="bg-blue-600 px-2 py-0.5 font-semibold text-white">Semana</span>
            <span className="px-2 py-0.5 text-slate-500">Día</span>
          </span>
        </div>
        <Card className="min-h-0 flex-1 overflow-hidden p-1.5">
          <div
            className="grid h-full text-[9px]"
            style={{ gridTemplateColumns: "2.2rem repeat(5, minmax(0, 1fr))", gridTemplateRows: `auto repeat(${HORAS.length}, minmax(0, 1fr))` }}
          >
            <span />
            {DIAS.map((d, i) => (
              <span
                key={d}
                className={cn("pb-1 text-center font-semibold", i === 2 ? "rounded-t bg-blue-50 text-blue-700" : "text-slate-500")}
              >
                {d}
              </span>
            ))}
            {HORAS.map((h, r) => (
              <span key={h} className="border-t border-slate-100 pr-1 pt-0.5 text-slate-500" style={{ gridColumn: 1, gridRow: r + 2 }}>
                {h}
              </span>
            ))}
            {HORAS.map((h, r) =>
              DIAS.map((d, c) => (
                <span
                  key={`${h}-${d}`}
                  className={cn("border-l border-t border-slate-100", c === 2 && "bg-blue-50/50")}
                  style={{ gridColumn: c + 2, gridRow: r + 2 }}
                />
              )),
            )}
            {CITAS.map((cita) => (
              <span
                key={`${cita.dia}-${cita.hora}`}
                className="z-10 m-px overflow-hidden rounded-md bg-blue-600 px-1 py-0.5 leading-tight text-white"
                style={{ gridColumn: cita.dia + 2, gridRow: cita.hora + 2 }}
              >
                <span className="hidden truncate font-semibold sm:block">{HORAS[cita.hora]}</span>
                <span className="block truncate">
                  {cita.nombre.split(" ")[0]}
                  <span className="hidden sm:inline"> {cita.nombre.split(" ")[1]}</span>
                </span>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </AppFrame>
  )
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>
}

export function FichaScreen() {
  return (
    <PacienteShell tab="Resumen">
      <div className="grid h-full gap-2.5 sm:grid-cols-[1.3fr_1fr]">
        <Card>
          <p className="text-xs font-semibold text-slate-900">Motivo y objetivos</p>
          <div className="mt-2">
            <Rotulo>Motivo de consulta</Rotulo>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
              Estrés por la carga laboral y dificultad para desconectarse.
            </p>
          </div>
          <div className="mt-2.5">
            <Rotulo>Objetivos de intervención</Rotulo>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700">Recuperar pausas durante la jornada.</p>
          </div>
        </Card>
        <div className="flex flex-col gap-2.5">
          <Card className="hidden sm:block">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900">Consentimiento informado</p>
              <Pill tone="green">Firmado</Pill>
            </div>
          </Card>
          <Card className="hidden space-y-1.5 sm:block">
            <p className="text-xs font-semibold text-slate-900">Contacto</p>
            <p className="flex items-center gap-1.5 text-[11px] text-blue-600">
              <MessageCircle className="size-3 shrink-0 text-slate-500" aria-hidden /> +56 9 0000 0001
            </p>
            <p className="flex items-center gap-1.5 truncate text-[11px] text-blue-600">
              <Mail className="size-3 shrink-0 text-slate-500" aria-hidden /> ana.ejemplo@example.com
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <Clock className="size-3 shrink-0 text-slate-500" aria-hidden /> Última sesión 14/10/2026
            </p>
          </Card>
        </div>
      </div>
    </PacienteShell>
  )
}

const DIALOGO = [
  { t: "00:12 - 00:18", quien: "Psicólogo", texto: "¿Cómo te fue esta semana con las pausas que conversamos?" },
  { t: "00:19 - 00:29", quien: "Paciente", texto: "Mejor. Logré cortar la hora de almuerzo casi todos los días." },
  { t: "00:31 - 00:36", quien: "Psicólogo", texto: "¿Qué cambió los días en que sí pudiste parar?" },
  { t: "00:38 - 00:47", quien: "Paciente", texto: "Dejé el celular en el escritorio y salí a caminar un rato." },
]

export function TranscripcionScreen() {
  return (
    <AppFrame nav="pacientes" crumb="Ana Rojas / Sesión 3">
      <div className="flex h-full flex-col gap-2.5">
        <Card className="flex items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Sesión 3 <span className="ml-1 text-[11px] font-normal text-slate-500">14/10/2026</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <Pill tone="slate">Sesión Presencial</Pill>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Completado
              </span>
            </p>
          </div>
          <span className="hidden gap-1.5 sm:flex">
            {["PDF", "Word"].map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                <FileDown className="size-3" aria-hidden /> {f}
              </span>
            ))}
          </span>
        </Card>
        <Card className="min-h-0 flex-1 overflow-hidden">
          <p className="text-xs font-semibold text-slate-900">Diálogo y Transcripción Clínica</p>
          <div className="mt-2 space-y-2">
            {DIALOGO.map((l) => {
              const psicologo = l.quien === "Psicólogo"
              return (
                <div
                  key={l.t}
                  className={cn("rounded-lg border px-2.5 py-1.5", psicologo ? "border-blue-200 bg-blue-50/40" : "border-emerald-200 bg-emerald-50/40")}
                >
                  <p className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold",
                        psicologo ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {psicologo ? <UserCheck className="size-2.5" aria-hidden /> : <User className="size-2.5" aria-hidden />}
                      {l.quien}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{l.t}</span>
                  </p>
                  <p className="mt-1 text-xs leading-snug text-slate-700">{l.texto}</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </AppFrame>
  )
}

const INFORME = [
  { titulo: "Motivo de consulta", texto: "Estrés por la carga laboral y dificultad para desconectarse." },
  { titulo: "Evolución", texto: "Retoma la pausa de almuerzo casi a diario y la asocia a menos cansancio al final del día." },
  { titulo: "Próxima sesión", texto: "Revisar cómo sostener las pausas en semanas de más carga." },
]

export function InformeScreen() {
  return (
    <PacienteShell tab="Asistente IA">
      <Card className="flex h-full flex-col gap-2 overflow-hidden">
        <div className="hidden items-center gap-2 border-b border-slate-100 pb-2 sm:flex">
          <span className="grid size-6 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              Chat IA del paciente <Pill tone="blue">IA</Pill>
            </p>
            <p className="truncate text-[10px] text-slate-500">Analiza sesiones y documentos con IA</p>
          </div>
        </div>
        <p className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-blue-600 px-2.5 py-1.5 text-[11px] leading-snug text-white">
          Elabora un informe clínico breve del proceso terapéutico de este paciente.
        </p>
        <div className="max-w-[92%] space-y-1.5 rounded-xl rounded-bl-sm border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Borrador de informe</p>
          {INFORME.map((s) => (
            <p key={s.titulo} className="text-[11px] leading-snug text-slate-700">
              <span className="font-semibold text-slate-900">{s.titulo}: </span>
              {s.texto}
            </p>
          ))}
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded-lg px-1 text-[11px] font-medium text-slate-500">
          <Save className="size-3" aria-hidden /> Guardar como informe
        </span>
      </Card>
    </PacienteShell>
  )
}

const COBROS = [
  { fecha: "07/10/2026", pago: "Pagado", boleta: "Emitida" },
  { fecha: "14/10/2026", pago: "Pendiente", boleta: "Sin boleta" },
]

export function CobrosScreen() {
  return (
    <PacienteShell tab="Cobros">
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Cobros y boletas</p>
            <p className="hidden truncate text-[11px] text-slate-500 sm:block">2 cobros. Registra el pago y prepara la boleta.</p>
          </div>
          <Boton>
            <Plus className="size-3" aria-hidden /> Registrar cobro
          </Boton>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {[
            ["Pagado este mes", "$35.000"],
            ["Pendiente este mes", "$35.000"],
            ["Retención estimada del mes", "$10.676"],
          ].map(([rotulo, monto], i) => (
            <Card key={rotulo} className={cn("py-2", i === 2 && "hidden lg:block")}>
              <p className="truncate text-[10px] text-slate-500">{rotulo}</p>
              <p className="text-sm font-bold text-slate-900">{monto}</p>
            </Card>
          ))}
        </div>
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[1fr_1fr_auto] gap-x-3 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-500 sm:grid sm:grid-cols-[1fr_1fr_5rem_5rem]">
            <span>Fecha</span>
            <span>Monto</span>
            <span>Pago</span>
            <span className="hidden sm:block">Boleta</span>
          </div>
          {COBROS.map((c) => (
            <div
              key={c.fecha}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-3 border-b border-slate-100 px-3 py-2 text-[11px] last:border-0 sm:grid-cols-[1fr_1fr_5rem_5rem]"
            >
              <span className="text-slate-700">{c.fecha}</span>
              <span className="font-semibold text-slate-800">$35.000</span>
              <span>
                <Pill tone={c.pago === "Pagado" ? "green" : "amber"}>{c.pago}</Pill>
              </span>
              <span className="hidden sm:block">
                <Pill tone={c.boleta === "Emitida" ? "green" : "slate"}>{c.boleta}</Pill>
              </span>
            </div>
          ))}
        </Card>
      </div>
    </PacienteShell>
  )
}

export function BoletasScreen() {
  return (
    <AppFrame nav="boletas" crumb="Boletas de honorarios">
      <div className="relative h-full">
        <div className="space-y-2 opacity-60 blur-[1.5px]" aria-hidden>
          <div className="h-12 rounded-xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-xl border border-slate-200 bg-white" />
        </div>
        <div className="absolute inset-0 grid place-items-center rounded-xl bg-slate-900/25 p-2">
          <div className="w-full max-w-sm space-y-2.5 rounded-2xl bg-white p-4 shadow-xl">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                Boleta de honorarios <Pill tone="amber">Por emitir</Pill>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Cobro del 15/10/2026 · Camila Pérez</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
              Pago <Pill tone="green">Pagado</Pill> el 15/10/2026
            </div>
            <div className="space-y-1 rounded-xl bg-slate-100/70 px-3 py-2 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span>Monto bruto</span>
                <span className="font-medium tabular-nums">$35.000</span>
              </div>
              <div className="flex justify-between">
                <span>Retención (15,25 %)</span>
                <span className="font-medium tabular-nums">−$5.338</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
                <span>Líquido</span>
                <span className="tabular-nums">$29.662</span>
              </div>
            </div>
            <Boton className="w-full justify-center py-2 text-xs">Emitir boleta</Boton>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden /> Sin entregar tu clave del Servicio de Impuestos Internos
            </p>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
