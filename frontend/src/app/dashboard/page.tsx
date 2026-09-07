"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Search,
  UserPlus,
  X,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash,
  Activity,
  Users,
  Clock,
  Sparkles,
  Phone,
  Calendar,
} from "lucide-react";
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
    dotClass: "bg-emerald-500",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/70 hover:bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  {
    value: "ALTA",
    label: "Alta",
    description: "Finalizado",
    dotClass: "bg-blue-500",
    className: "bg-blue-50 text-blue-700 border-blue-200/70 hover:bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  },
  {
    value: "ABANDONO",
    label: "Abandono",
    description: "Interrumpido",
    dotClass: "bg-rose-500",
    className: "bg-rose-50 text-rose-700 border-rose-200/70 hover:bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60",
  },
  {
    value: "PAUSADO",
    label: "Pausado",
    description: "Interrupción temporal",
    dotClass: "bg-amber-500",
    className: "bg-amber-50 text-amber-700 border-amber-200/70 hover:bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  },
  {
    value: "DERIVADO",
    label: "Derivado",
    description: "Referido a otro profesional",
    dotClass: "bg-violet-500",
    className: "bg-violet-50 text-violet-700 border-violet-200/70 hover:bg-violet-50 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800/60",
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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
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

  const totalPacientes = pacientes.length;
  const enSesionCount = pacientes.filter(
    (p) => !p.estado || p.estado === "EN_SESION"
  ).length;
  const pausadoCount = pacientes.filter((p) => p.estado === "PAUSADO").length;
  const altaCount = pacientes.filter((p) => p.estado === "ALTA").length;

  const filtered = pacientes.filter((p) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      p.nombre.toLowerCase().includes(term) ||
      p.apellido.toLowerCase().includes(term) ||
      (p.nombre_completo && p.nombre_completo.toLowerCase().includes(term));
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "EN_SESION" && (!p.estado || p.estado === "EN_SESION")) ||
      p.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm font-medium tracking-tight">Cargando directorio clínico...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      {/* ── Header Principal ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Directorio de Pacientes
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {totalPacientes} total
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de expedientes clínicos, seguimiento terapéutico y estados de tratamiento.
          </p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(!showForm);
          }}
          className="gap-2 rounded-xl shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 bg-primary text-primary-foreground font-semibold px-4.5 h-10.5"
          size="lg"
        >
          <UserPlus className="h-4 w-4" />
          <span>Nuevo paciente</span>
        </Button>
      </div>

      {/* ── Clinical Cockpit: Tarjetas de Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`text-left group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
            statusFilter === "ALL"
              ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs"
              : "border-border/70 bg-card hover:border-border hover:shadow-subtle"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Registrados
            </span>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {totalPacientes}
            </span>
            <span className="text-xs text-muted-foreground">pacientes</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Fichas clínicas en sistema
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("EN_SESION")}
          className={`text-left group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
            statusFilter === "EN_SESION"
              ? "border-emerald-500/50 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20 shadow-xs"
              : "border-border/70 bg-card hover:border-border hover:shadow-subtle"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              En Sesión Activa
            </span>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {enSesionCount}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              en curso
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Tratamiento activo regular
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PAUSADO")}
          className={`text-left group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
            statusFilter === "PAUSADO"
              ? "border-amber-500/50 bg-amber-500/[0.04] ring-1 ring-amber-500/20 shadow-xs"
              : "border-border/70 bg-card hover:border-border hover:shadow-subtle"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              En Pausa / Espera
            </span>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-110">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {pausadoCount}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              en pausa
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Interrupción temporal o espera
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("ALTA")}
          className={`text-left group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
            statusFilter === "ALTA"
              ? "border-blue-500/50 bg-blue-500/[0.04] ring-1 ring-blue-500/20 shadow-xs"
              : "border-border/70 bg-card hover:border-border hover:shadow-subtle"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Altas Clínicas
            </span>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {altaCount}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              concluidos
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Objetivos terapéuticos cumplidos
          </p>
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-primary/20 bg-card p-6 sm:p-7 shadow-elevated transition-all">
          <div className="mb-6 flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Registrar nuevo paciente
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ingresa los datos para generar el expediente clínico inicial.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowForm(false)}
              className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Información Personal
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Nombre *</label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Sofía"
                    maxLength={100}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Apellido *</label>
                  <Input
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    placeholder="Ej. Martínez"
                    maxLength={100}
                    required
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">RUT / Identificación</label>
                  <Input
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="Ej: 12.345.678-9"
                    maxLength={12}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Fecha de nacimiento</label>
                  <Input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Sexo</label>
                  <select
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="N">No especifica</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contacto y Consulta
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Ocupación laboral</label>
                  <Input
                    value={ocupacion}
                    onChange={(e) => setOcupacion(e.target.value)}
                    placeholder="Ej: Ingeniero, Docente..."
                    maxLength={200}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">Correo de contacto</label>
                  <Input
                    type="email"
                    value={emailContacto}
                    onChange={(e) => setEmailContacto(e.target.value)}
                    placeholder="paciente@correo.com"
                    maxLength={254}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80">WhatsApp</label>
                  <Input
                    value={telefonoWhatsapp}
                    onChange={(e) => setTelefonoWhatsapp(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    maxLength={30}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Motivo inicial de consulta</label>
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Manejo de estrés laboral, duelo, síntomas ansiosos..."
                  className="rounded-xl"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl text-xs font-semibold px-5">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Crear expediente"}
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

      {/* ── Toolbar: Buscador y Pestañas de Filtro Rápido ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10.5 w-full rounded-xl border-border/70 bg-card pl-10 pr-10 text-sm shadow-xs transition-all focus-visible:ring-primary/25 placeholder:text-muted-foreground/60"
            placeholder="Buscar por nombre o apellido..."
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-1 rounded-full transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Pestañas de Filtro Rápido */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-muted/40 rounded-xl border border-border/60 text-xs font-medium self-start md:self-auto">
          {[
            { id: "ALL", label: "Todos", count: totalPacientes },
            { id: "EN_SESION", label: "En sesión", count: enSesionCount },
            { id: "PAUSADO", label: "Pausados", count: pausadoCount },
            { id: "ALTA", label: "Altas", count: altaCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === tab.id
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  statusFilter === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-border/60 bg-card/60 shadow-subtle">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/70">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold text-foreground">Sin pacientes encontrados</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {search
              ? "No hay pacientes que coincidan con los términos de búsqueda o filtros seleccionados."
              : "Comienza registrando tu primer paciente con el botón 'Nuevo paciente'."}
          </p>
          {(search || statusFilter !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
              className="mt-4 rounded-xl text-xs"
            >
              Restablecer filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* ── Mobile: Patient Cards ── */}
          <div className="space-y-3 md:hidden">
            {filtered.map((paciente) => (
              <div
                key={paciente.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-subtle active:bg-muted/40 transition-colors cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".action-menu")) return;
                  router.push(`/dashboard/pacientes/${paciente.id}`);
                }}
              >
                <Avatar className={`h-11 w-11 shrink-0 rounded-xl border ${getAvatarColor(paciente.nombre_completo)}`}>
                  <AvatarFallback className="font-semibold bg-transparent text-sm">
                    {getInitials(paciente.nombre, paciente.apellido)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{paciente.nombre_completo}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPatientStatus(paciente.estado).className}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${getPatientStatus(paciente.estado).dotClass || "bg-emerald-500"}`}
                      />
                      <span>{getPatientStatus(paciente.estado).label}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {formatDate(paciente.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="action-menu shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-muted-foreground">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
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
          <div className="hidden md:block rounded-2xl border border-border/70 bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-11">
                    Paciente
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground h-11">
                    Última Actualización
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground h-11">
                    Estado Clínico
                  </TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground pr-6 h-11">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((paciente) => (
                  <TableRow
                    key={paciente.id}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-muted/30 border-b border-border/40"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".action-menu")) return;
                      router.push(`/dashboard/pacientes/${paciente.id}`);
                    }}
                  >
                    <TableCell className="pl-6 py-3.5">
                      <div className="flex items-center gap-3.5">
                        <Avatar className={`h-10 w-10 rounded-xl border ${getAvatarColor(paciente.nombre_completo)}`}>
                          <AvatarFallback className="font-semibold bg-transparent text-xs">
                            {getInitials(paciente.nombre, paciente.apellido)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {paciente.nombre_completo}
                          </div>
                          {paciente.activo === false && (
                            <span className="text-[10px] text-muted-foreground font-medium">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(paciente.updated_at)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPatientStatus(paciente.estado).className}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${getPatientStatus(paciente.estado).dotClass || "bg-emerald-500"} ${
                            paciente.estado === "EN_SESION" || !paciente.estado ? "animate-pulse" : ""
                          }`}
                        />
                        <span>{getPatientStatus(paciente.estado).label}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6 action-menu">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hidden lg:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pacientes/${paciente.id}`);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          <span>Ficha</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
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
                      </div>
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
