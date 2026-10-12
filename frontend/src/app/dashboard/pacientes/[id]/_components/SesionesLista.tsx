"use client";

import Link from "next/link";
import { Calendar, ClipboardList, Clock, MoreHorizontal, Receipt, Trash2, Users, Video } from "lucide-react";
import { cn, formatDate, formatDuration, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getStatusBadge, getStatusLabel, type Sesion } from "./utils";

const ORIGENES = {
  VIRTUAL: { label: "Virtual", icon: Video, className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  TEST_PSICOLOGICO: {
    label: "Test",
    icon: ClipboardList,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  PRESENCIAL: { label: "Presencial", icon: Calendar, className: "bg-primary/10 text-primary" },
} as const;

function getOrigen(sesion: Sesion) {
  if (sesion.origen === "VIRTUAL") return ORIGENES.VIRTUAL;
  if (sesion.origen === "TEST_PSICOLOGICO") return ORIGENES.TEST_PSICOLOGICO;
  return ORIGENES.PRESENCIAL;
}

function getMes(fecha: string) {
  const label = new Date(fecha).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Pestaña "Sesiones": sesiones clínicas y tests agrupados por mes, con eliminar dentro de un menú.
export default function SesionesLista({
  pacienteId,
  sesiones,
  creatingSession,
  showRemote,
  onNewPresencial,
  onNewVirtual,
  onNewRemote,
  onDelete,
  onCobro,
}: {
  pacienteId: string;
  sesiones: Sesion[];
  creatingSession: boolean;
  showRemote: boolean;
  onNewPresencial: () => void;
  onNewVirtual: () => void;
  onNewRemote: () => void;
  onDelete: (sesion: Sesion) => void;
  onCobro?: (sesion: Sesion) => void;
}) {
  const grupos: { mes: string; items: Sesion[] }[] = [];
  for (const sesion of sesiones) {
    const mes = getMes(sesion.fecha_hora_inicio);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.mes === mes) ultimo.items.push(sesion);
    else grupos.push({ mes, items: [sesion] });
  }

  const acciones = (
    <div className="flex flex-wrap gap-2">
      {showRemote && (
        <Button variant="outline" size="sm" onClick={onNewRemote}>
          <Video />
          Sesión remota
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onNewVirtual}>
        <Video />
        Virtual Psiconex
      </Button>
      <Button size="sm" onClick={onNewPresencial} disabled={creatingSession}>
        <Users />
        Presencial
      </Button>
    </div>
  );

  if (sesiones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-16 text-center">
        <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">Sin sesiones clínicas registradas</p>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Registra la primera sesión del paciente.</p>
        {acciones}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">
            Sesiones <span className="font-normal text-muted-foreground">({sesiones.length})</span>
          </h2>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda de origen">
            {Object.values(ORIGENES).map(({ label, icon: Icon, className }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-md", className)}>
                  <Icon className="h-3 w-3" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        {acciones}
      </div>

      {grupos.map((grupo) => (
        <section key={grupo.mes} aria-label={grupo.mes}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo.mes}</h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            {grupo.items.map((sesion) => {
              const origen = getOrigen(sesion);
              const Icon = origen.icon;
              const isTest = sesion.origen === "TEST_PSICOLOGICO";
              const titulo = isTest
                ? sesion.documento_nombre_original || "Test psicológico"
                : sesion.numero_sesion
                ? `Sesión ${sesion.numero_sesion}`
                : "Sesión";
              return (
                <li key={sesion.id} className="flex items-center gap-2 pr-2 transition-colors hover:bg-muted/40">
                  <Link
                    href={`/dashboard/pacientes/${pacienteId}/sesiones/${sesion.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", origen.className)}
                      title={origen.label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="sr-only">{origen.label}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{titulo}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{formatDate(sesion.fecha_hora_inicio)}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(sesion.fecha_hora_inicio)}
                        </span>
                        {sesion.duracion_segundos ? <span>{formatDuration(sesion.duracion_segundos)}</span> : null}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex",
                        getStatusBadge(sesion.estado)
                      )}
                    >
                      {getStatusLabel(sesion.estado)}
                    </span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Acciones de ${titulo}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {onCobro && (
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onCobro(sesion)}>
                          <Receipt className="mr-2 h-4 w-4" />
                          Registrar cobro
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => onDelete(sesion)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
