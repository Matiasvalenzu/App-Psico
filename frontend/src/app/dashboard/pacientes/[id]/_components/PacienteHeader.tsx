"use client";

import {
  ChevronDown,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Send,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPacienteEstadoLabel, getSexoLabel, tieneRiesgo, type Paciente } from "./utils";
import type { TestMode } from "./TestDialog";

// Identidad del paciente con una sola acción primaria ("Nueva sesión") y el resto en menús.
export default function PacienteHeader({
  paciente,
  creatingSession,
  onNewPresencial,
  onNewVirtual,
  onTest,
  onEdit,
  onTutorial,
}: {
  paciente: Paciente;
  creatingSession: boolean;
  onNewPresencial: () => void;
  onNewVirtual: () => void;
  onTest: (mode: TestMode) => void;
  onEdit: () => void;
  onTutorial: () => void;
}) {
  const meta = [
    paciente.rut,
    paciente.edad ? `${paciente.edad} años` : null,
    paciente.sexo && paciente.sexo !== "N" ? getSexoLabel(paciente.sexo) : null,
    paciente.ocupacion_laboral,
  ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-lg font-semibold text-foreground sm:h-16 sm:w-16 sm:text-xl"
          >
            {paciente.nombre.charAt(0).toUpperCase()}
            {paciente.apellido.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">{paciente.nombre_completo}</h1>
              {tieneRiesgo(paciente) && <Badge variant="destructive">Riesgo</Badge>}
              <Badge variant="secondary">{getPacienteEstadoLabel(paciente.estado)}</Badge>
              {paciente.activo === false && <Badge variant="outline">Inactivo</Badge>}
            </div>
            {meta.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {meta.map((item, i) => (
                  <span key={i}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    <span className={i === 0 && paciente.rut ? "font-mono" : undefined}>{item}</span>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex-1 sm:flex-none" disabled={creatingSession}>
                {creatingSession ? <Loader2 className="animate-spin" /> : <Plus />}
                Nueva sesión
                <ChevronDown className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer" onClick={onNewPresencial}>
                <Users className="mr-2 h-4 w-4" />
                Presencial
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={onNewVirtual}>
                <Video className="mr-2 h-4 w-4" />
                Virtual Psiconex
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {paciente.telefono_whatsapp && (
            <Button variant="outline" size="icon" asChild>
              <a
                href={`https://wa.me/${paciente.telefono_whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir chat de WhatsApp"
                title="WhatsApp"
              >
                <MessageCircle className="text-emerald-600 dark:text-emerald-400" />
              </a>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Más acciones">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer" onClick={() => onTest("start")}>
                  <Play className="mr-2 h-4 w-4" />
                  Comenzar test
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => onTest("send")}>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar test
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar ficha
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={onTutorial}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Ver tutorial de la ficha
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
