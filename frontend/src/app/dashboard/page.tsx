"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Loader2, Plus, Search, UserPlus, X, MoreHorizontal, Eye, Pencil, Trash, Activity } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  estado: string;
  activo: boolean;
  updated_at: string;
}

function calcularEdad(fecha: string): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  const nac = new Date(fecha);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;

    const fieldLabels: Record<string, string> = {
      nombre: "Nombre",
      apellido: "Apellido",
      fecha_nacimiento: "Fecha de nacimiento",
      rut: "RUT",
      edad: "Edad",
      sexo: "Sexo",
      ocupacion_laboral: "Ocupación laboral",
      email_contacto: "Correo de contacto",
      telefono_whatsapp: "WhatsApp",
      motivo_consulta: "Motivo de consulta",
    };

    for (const [field, value] of Object.entries(data)) {
      const label = fieldLabels[field] || field;
      if (Array.isArray(value)) return `${label}: ${value.join(" ")}`;
      if (typeof value === "string") return `${label}: ${value}`;
    }
  } catch {
    // Keep the generic message when the response is not JSON.
  }

  return fallback;
}

const PATIENT_STATUS_OPTIONS = [
  {
    value: "EN_SESION",
    label: "En sesión",
    description: "Activo",
    className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  {
    value: "ALTA",
    label: "Alta",
    description: "Finalizado",
    className: "bg-blue-50 text-blue-700 hover:bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300",
  },
  {
    value: "ABANDONO",
    label: "Abandono",
    description: "Interrumpido",
    className: "bg-rose-50 text-rose-700 hover:bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300",
  },
  {
    value: "PAUSADO",
    label: "Pausado",
    description: "Interrupción temporal",
    className: "bg-amber-50 text-amber-700 hover:bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300",
  },
  {
    value: "DERIVADO",
    label: "Derivado",
    description: "Referido a otro profesional",
    className: "bg-violet-50 text-violet-700 hover:bg-violet-50 dark:bg-violet-950/50 dark:text-violet-300",
  },
] as const;

function getPatientStatus(value?: string) {
  return (
    PATIENT_STATUS_OPTIONS.find((status) => status.value === value) ||
    PATIENT_STATUS_OPTIONS[0]
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [rut, setRut] = useState("");
  const [edad, setEdad] = useState("");
  const [sexo, setSexo] = useState("N");
  const [ocupacion, setOcupacion] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [pacienteToDelete, setPacienteToDelete] = useState<Paciente | null>(null);
  const [deletingPaciente, setDeletingPaciente] = useState(false);
  const [deletePacienteError, setDeletePacienteError] = useState("");

  useEffect(() => {
    const calc = calcularEdad(fechaNacimiento);
    if (calc !== null) setEdad(calc.toString());
  }, [fechaNacimiento]);

  useEffect(() => {
    loadPacientes();
  }, []);

  async function loadPacientes() {
    try {
      const res = await apiFetch("/pacientes/");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPacientes(data.results || data);
    } catch {
      setError("No se pudieron cargar los pacientes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await apiFetch("/pacientes/", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          fecha_nacimiento: fechaNacimiento || null,
          rut: rut.trim(),
          edad: edad ? parseInt(edad) : null,
          sexo,
          ocupacion_laboral: ocupacion.trim(),
          email_contacto: emailContacto.trim(),
          telefono_whatsapp: telefonoWhatsapp.trim(),
          motivo_consulta: motivo.trim(),
        }),
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "No se pudo guardar el paciente."));
      const nuevo = await res.json();
      setPacientes((prev) => [nuevo, ...prev]);
      setShowForm(false);
      setNombre("");
      setApellido("");
      setFechaNacimiento("");
      setRut("");
      setEdad("");
      setSexo("N");
      setOcupacion("");
      setEmailContacto("");
      setTelefonoWhatsapp("");
      setMotivo("");
      setSuccess("Paciente creado correctamente.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el paciente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeEstado(paciente: Paciente, estado: string) {
    if (paciente.estado === estado) return;
    setError("");
    setSuccess("");
    setUpdatingStatusId(paciente.id);
    try {
      const res = await apiFetch(`/pacientes/${paciente.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPacientes((prev) =>
        prev.map((item) =>
          item.id === paciente.id
            ? { ...item, estado: updated.estado, updated_at: updated.updated_at || item.updated_at }
            : item
        )
      );
      setSuccess(`Estado actualizado a ${getPatientStatus(estado).label}.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("No se pudo actualizar el estado del paciente.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDeletePaciente() {
    if (!pacienteToDelete) return;
    setDeletingPaciente(true);
    setDeletePacienteError("");
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/pacientes/${pacienteToDelete.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setPacientes((prev) => prev.filter((paciente) => paciente.id !== pacienteToDelete.id));
      setSuccess("Paciente eliminado correctamente.");
      setPacienteToDelete(null);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setDeletePacienteError("No se pudo eliminar el paciente.");
    } finally {
      setDeletingPaciente(false);
    }
  }

  const filtered = pacientes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.apellido.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-lg font-medium">Cargando pacientes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pacientes.length} paciente{pacientes.length !== 1 ? "s" : ""} registrado{pacientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(!showForm);
          }}
          className="gap-2 shadow-subtle transition-all hover:-translate-y-0.5 hover:shadow-card"
          size="lg"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo paciente
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-6 shadow-elevated">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <h2 className="text-lg font-semibold">Registrar paciente</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowForm(false)}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del paciente"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Apellido</label>
                <Input
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  placeholder="Apellido del paciente"
                  maxLength={100}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RUT</label>
              <Input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="Ej: 12.345.678-9"
                maxLength={12}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de nacimiento</label>
                <Input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sexo</label>
                <select
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="N">No especifica</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ocupación laboral</label>
              <Input
                value={ocupacion}
                onChange={(e) => setOcupacion(e.target.value)}
                placeholder="Ej: Ingeniero, Docente, Estudiante..."
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Correo de contacto</label>
              <Input
                type="email"
                value={emailContacto}
                onChange={(e) => setEmailContacto(e.target.value)}
                placeholder="correo@ejemplo.com"
                maxLength={254}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp</label>
              <Input
                value={telefonoWhatsapp}
                onChange={(e) => setTelefonoWhatsapp(e.target.value)}
                placeholder="Ej: +56 9 1234 5678"
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo de consulta</label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Ansiedad generalizada, depresión..."
              />
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Guardar paciente"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Plus className="h-3 w-3 rotate-45" />
          </div>
          <span className="font-medium">{success}</span>
        </div>
      )}

      <div className="relative max-w-full">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 w-full rounded-full border-border/60 bg-card pl-11 pr-4 text-base shadow-subtle transition-all focus-visible:ring-primary/30"
          placeholder="Buscar por nombre o apellido..."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-border/50 bg-card shadow-card">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
            <Search className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-semibold">Sin pacientes encontrados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? "Intenta con otros términos de búsqueda." : "Crea tu primer paciente para comenzar."}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile: Patient Cards ── */}
          <div className="space-y-3 md:hidden">
            {filtered.map((paciente) => (
              <div
                key={paciente.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-subtle active:bg-muted/40 transition-colors cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.action-menu')) return;
                  router.push(`/dashboard/pacientes/${paciente.id}`);
                }}
              >
                <Avatar className={`h-11 w-11 shrink-0 border ${getAvatarColor(paciente.nombre_completo)}`}>
                  <AvatarFallback className="font-semibold bg-transparent text-sm">
                    {getInitials(paciente.nombre, paciente.apellido)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{paciente.nombre_completo}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`font-normal px-2 py-0 text-[10px] ${getPatientStatus(paciente.estado).className}`}
                    >
                      {getPatientStatus(paciente.estado).label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {formatDate(paciente.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="action-menu shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-elevated">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                          Acciones
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pacientes/${paciente.id}`);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4 text-primary" />
                          Ver ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pacientes/${paciente.id}?editar=1`);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar paciente
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPacienteToDelete(paciente);
                          setDeletePacienteError("");
                        }}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Eliminar paciente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: Table ── */}
          <div className="hidden md:block rounded-2xl border border-border/50 bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground/80 pl-6 h-12">Nombre</TableHead>
                  <TableHead className="font-semibold text-foreground/80 h-12">Última Actualización</TableHead>
                  <TableHead className="font-semibold text-foreground/80 h-12">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-foreground/80 pr-6 h-12">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((paciente) => (
                  <TableRow
                    key={paciente.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('.action-menu')) return;
                      router.push(`/dashboard/pacientes/${paciente.id}`);
                    }}
                  >
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className={`h-10 w-10 border ${getAvatarColor(paciente.nombre_completo)}`}>
                          <AvatarFallback className="font-semibold bg-transparent">
                            {getInitials(paciente.nombre, paciente.apellido)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium text-base tracking-tight">{paciente.nombre_completo}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(paciente.updated_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`font-normal px-3 py-0.5 text-xs ${getPatientStatus(paciente.estado).className}`}
                      >
                        {getPatientStatus(paciente.estado).label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 action-menu">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-100 transition-opacity hover:bg-muted data-[popup-open]:bg-muted sm:opacity-0 sm:group-hover:opacity-100 sm:data-[popup-open]:opacity-100"
                          >
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-elevated">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                              Acciones
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/pacientes/${paciente.id}`);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4 text-primary" />
                              Ver ficha
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/pacientes/${paciente.id}?editar=1`);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar paciente
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                              <Activity className="mr-2 h-4 w-4" />
                              <span>Cambiar Estado</span>
                              {updatingStatusId === paciente.id && (
                                <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
                              )}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-64 rounded-xl shadow-elevated">
                              <DropdownMenuRadioGroup
                                value={paciente.estado || "EN_SESION"}
                                onValueChange={(estado) => handleChangeEstado(paciente, estado)}
                              >
                                {PATIENT_STATUS_OPTIONS.map((status) => (
                                  <DropdownMenuRadioItem
                                    key={status.value}
                                    value={status.value}
                                    className="cursor-pointer py-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="flex flex-col">
                                      <span className="text-sm font-medium">{status.label}</span>
                                      <span className="text-xs text-muted-foreground">{status.description}</span>
                                    </span>
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPacienteToDelete(paciente);
                              setDeletePacienteError("");
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Eliminar paciente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(pacienteToDelete)}
        title="Eliminar paciente"
        description={
          pacienteToDelete
            ? `Esta acción eliminará a ${pacienteToDelete.nombre_completo} y no se puede deshacer.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar paciente"
        confirming={deletingPaciente}
        error={deletePacienteError}
        onCancel={() => {
          if (deletingPaciente) return;
          setPacienteToDelete(null);
          setDeletePacienteError("");
        }}
        onConfirm={handleDeletePaciente}
      />
    </div>
  );
}
