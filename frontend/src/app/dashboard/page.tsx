"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";
import { formatRut, isValidRut } from "@/lib/rut";
import {
  AlertTriangle,
  Lock,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  RotateCw,
  Search,
  Trash,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ImportarPacientes from "@/components/pacientes/ImportarPacientes";
import CompletaConfiguracion from "@/components/onboarding/CompletaConfiguracion";
import ResumenCobros from "@/components/pacientes/ResumenCobros";
import UpsellPlusModal from "@/components/suscripcion/UpsellPlusModal";
import type { OrigenUpsell } from "@/lib/upsell";
import { useTutorial } from "@/context/TutorialContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  rut?: string;
  edad?: number | null;
  fecha_nacimiento?: string | null;
  estado: string;
  activo: boolean;
  updated_at: string;
  riesgo_suicida?: boolean;
  ideacion_suicida_nivel?: number | null;
  es_menor_edad?: boolean;
  ultima_sesion?: string | null;
  proxima_cita?: string | null;
  consentimiento_estado?: string | null;
  consentimiento_papel_fecha?: string | null;
  deuda_pendiente?: number;
  cobros_pendientes?: number;
}

type SortKey = "nombre" | "ultima_sesion" | "proxima_cita" | "deuda";

const PAGE_SIZE = 25;

function calcularEdad(fecha?: string | null): number | null {
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

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;

    const fieldLabels: Record<string, string> = {
      nombre: "Nombre",
      apellido: "Apellido",
      fecha_nacimiento: "Fecha de nacimiento",
      rut: "RUT",
      numero_documento: "Documento",
      edad: "Edad",
      sexo: "Sexo",
      ocupacion_laboral: "Ocupación laboral",
      email_contacto: "Correo de contacto",
      telefono_whatsapp: "WhatsApp",
      motivo_consulta: "Motivo de consulta",
    };

    for (const [field, value] of Object.entries(data)) {
      const message = Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
      if (!message) continue;
      if (field === "non_field_errors") return message;
      return `${fieldLabels[field] || field}: ${message}`;
    }
  } catch {
    // Keep the generic message when the response is not JSON.
  }

  return fallback;
}

const PATIENT_STATUS_OPTIONS = [
  {
    value: "EN_SESION",
    label: "Activo",
    description: "En tratamiento",
    dotClass: "bg-emerald-500",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  {
    value: "ALTA",
    label: "Alta",
    description: "Finalizado",
    dotClass: "bg-blue-500",
    className: "bg-blue-50 text-blue-700 border-blue-200/70 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  },
  {
    value: "ABANDONO",
    label: "Abandono",
    description: "Interrumpido",
    dotClass: "bg-rose-500",
    className: "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60",
  },
  {
    value: "PAUSADO",
    label: "Pausado",
    description: "Interrupción temporal",
    dotClass: "bg-amber-500",
    className: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  },
  {
    value: "DERIVADO",
    label: "Derivado",
    description: "Referido a otro profesional",
    dotClass: "bg-violet-500",
    className: "bg-violet-50 text-violet-700 border-violet-200/70 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800/60",
  },
] as const;

function getPatientStatus(value?: string) {
  return (
    PATIENT_STATUS_OPTIONS.find((status) => status.value === value) ||
    PATIENT_STATUS_OPTIONS[0]
  );
}

function etiquetaConsentimiento(estado?: string | null, papel?: string | null) {
  if (estado === "FIRMADO") return { label: "Firmado", className: "text-emerald-700 dark:text-emerald-400" };
  if (papel) return { label: "En papel", className: "text-emerald-700 dark:text-emerald-400" };
  if (estado === "ENVIADO") return { label: "Pendiente", className: "text-amber-700 dark:text-amber-400" };
  if (estado === "RECHAZADO") return { label: "Rechazado", className: "text-rose-700 dark:text-rose-400" };
  return { label: "No generado", className: "text-muted-foreground" };
}

function getEdad(p: Paciente) {
  return p.edad ?? calcularEdad(p.fecha_nacimiento);
}

function tieneRiesgo(p: Paciente) {
  return Boolean(p.riesgo_suicida) || (p.ideacion_suicida_nivel ?? 0) > 0;
}

function compareDates(a: string | null | undefined, b: string | null | undefined, dir: 1 | -1) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return (new Date(a).getTime() - new Date(b).getTime()) * dir;
}

function StatusBadge({ estado }: { estado: string }) {
  const status = getPatientStatus(estado);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} aria-hidden="true" />
      {status.label}
    </span>
  );
}

function DeudaBadge({ paciente, bloqueado, onBloqueo }: { paciente: Paciente; bloqueado?: boolean; onBloqueo?: () => void }) {
  if (bloqueado) {
    return (
      <button type="button" onClick={onBloqueo} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        Debe
      </button>
    );
  }
  if (!paciente.deuda_pendiente) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      Debe ${paciente.deuda_pendiente.toLocaleString("es-CL")} · {paciente.cobros_pendientes === 1 ? "1 cobro" : `${paciente.cobros_pendientes} cobros`}
    </span>
  );
}

function AlertChips({ paciente }: { paciente: Paciente }) {
  const riesgo = tieneRiesgo(paciente);
  if (!riesgo && !paciente.es_menor_edad) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {riesgo && (
        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Riesgo
        </span>
      )}
      {paciente.es_menor_edad && (
        <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300">
          Menor
        </span>
      )}
    </div>
  );
}

function ConsentimientoText({ estado, papel }: { estado?: string | null; papel?: string | null }) {
  const info = etiquetaConsentimiento(estado, papel);
  return <span className={`text-xs font-medium ${info.className}`}>{info.label}</span>;
}

function PacienteMeta({ paciente }: { paciente: Paciente }) {
  const edad = getEdad(paciente);
  const parts = [paciente.rut, edad !== null ? `${edad} años` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="truncate text-xs text-muted-foreground">{parts.join(" · ")}</div>;
}

function PatientActionsMenu({
  paciente,
  updating,
  onOpen,
  onEdit,
  onChangeEstado,
  onDelete,
}: {
  paciente: Paciente;
  updating: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onChangeEstado: (estado: string) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Acciones para ${paciente.nombre_completo}`}>
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-elevated">
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" onClick={onOpen}>
            <Eye className="mr-2 h-4 w-4" />
            Ver ficha
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar paciente
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Cambiar estado
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={paciente.estado || "EN_SESION"}
            onValueChange={(estado) => onChangeEstado(estado as string)}
          >
            {PATIENT_STATUS_OPTIONS.map((status) => (
              <DropdownMenuRadioItem key={status.value} value={status.value} className="cursor-pointer">
                <span className={`mr-2 h-2 w-2 rounded-full ${status.dotClass}`} aria-hidden="true" />
                {status.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={onDelete}>
          <Trash className="mr-2 h-4 w-4" />
          Eliminar paciente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card" aria-busy="true" aria-label="Cargando pacientes">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { openTutorial } = useTutorial();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<SortKey>("nombre");
  const [soloDeudores, setSoloDeudores] = useState(false);
  const [plus, setPlus] = useState<boolean | null>(null);
  const [enPrueba, setEnPrueba] = useState(false);
  const [boletasConfiguradas, setBoletasConfiguradas] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const [upsellOrigen, setUpsellOrigen] = useState<OrigenUpsell>("dashboard");
  const [page, setPage] = useState(1);
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
  const [formError, setFormError] = useState("");
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
    getCurrentUser()
      .then((user) => {
        setPlus(Boolean(user.boletas_habilitadas));
        setEnPrueba(user.suscripcion_estado === "trial");
        setBoletasConfiguradas(Boolean(user.boletas_configuradas));
      })
      .catch(() => setPlus(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sort, soloDeudores]);

  async function loadPacientes() {
    setLoading(true);
    setLoadError("");
    try {
      // La API pagina de a 20: se recorren todas las páginas para que contadores y búsqueda sean completos.
      const all: Paciente[] = [];
      for (let p = 1; ; p++) {
        const res = await apiFetch(`/pacientes/?page=${p}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (Array.isArray(data)) {
          all.push(...data);
          break;
        }
        all.push(...(data.results || []));
        if (!data.next) break;
      }
      setPacientes(all);
    } catch {
      setLoadError("No se pudieron cargar los pacientes. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
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
    setFormError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (rut.trim() && !isValidRut(rut)) {
      setFormError("RUT: el dígito verificador no es válido.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/pacientes/", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          fecha_nacimiento: fechaNacimiento || null,
          rut: rut.trim() ? formatRut(rut) : "",
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
      resetForm();
      toast.success("Paciente creado correctamente.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el paciente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeEstado(paciente: Paciente, estado: string) {
    if ((paciente.estado || "EN_SESION") === estado) return;
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
      toast.success(`Estado actualizado a ${getPatientStatus(estado).label}.`);
    } catch {
      toast.error("No se pudo actualizar el estado del paciente.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDeletePaciente() {
    if (!pacienteToDelete) return;
    setDeletingPaciente(true);
    setDeletePacienteError("");
    try {
      const res = await apiFetch(`/pacientes/${pacienteToDelete.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setPacientes((prev) => prev.filter((paciente) => paciente.id !== pacienteToDelete.id));
      setPacienteToDelete(null);
      toast.success("Paciente eliminado correctamente.");
    } catch {
      setDeletePacienteError("No se pudo eliminar el paciente.");
    } finally {
      setDeletingPaciente(false);
    }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: pacientes.length };
    for (const status of PATIENT_STATUS_OPTIONS) result[status.value] = 0;
    for (const p of pacientes) {
      const key = p.estado || "EN_SESION";
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, [pacientes]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const termRut = term.replace(/[^0-9k]/g, "");
    const list = pacientes.filter((p) => {
      const matchesSearch =
        !term ||
        p.nombre_completo?.toLowerCase().includes(term) ||
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
        (termRut.length >= 3 && (p.rut || "").toLowerCase().replace(/[^0-9k]/g, "").includes(termRut));
      const matchesStatus = statusFilter === "ALL" || (p.estado || "EN_SESION") === statusFilter;
      return matchesSearch && matchesStatus && (!soloDeudores || Boolean(p.deuda_pendiente));
    });
    return list.sort((a, b) => {
      if (sort === "deuda") return (b.deuda_pendiente || 0) - (a.deuda_pendiente || 0) || (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es");
      if (sort === "ultima_sesion") return compareDates(a.ultima_sesion, b.ultima_sesion, -1);
      if (sort === "proxima_cita") return compareDates(a.proxima_cita, b.proxima_cita, 1);
      return (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es");
    });
  }, [pacientes, search, statusFilter, sort, soloDeudores]);
  const conDeuda = pacientes.filter((p) => p.deuda_pendiente).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(search) || statusFilter !== "ALL" || soloDeudores;

  const openFicha = (p: Paciente) => router.push(`/dashboard/pacientes/${p.id}`);
  const menuProps = (p: Paciente) => ({
    paciente: p,
    updating: updatingStatusId === p.id,
    onOpen: () => openFicha(p),
    onEdit: () => router.push(`/dashboard/pacientes/${p.id}?editar=1`),
    onChangeEstado: (estado: string) => handleChangeEstado(p, estado),
    onDelete: () => {
      setPacienteToDelete(p);
      setDeletePacienteError("");
    },
  });

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Busca, filtra y abre la ficha de tus pacientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openTutorial("pacientes")} className="gap-1.5 text-muted-foreground">
            <PlayCircle className="h-4 w-4" />
            Tutorial
          </Button>
          <ImportarPacientes onDone={loadPacientes} />
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        </div>
      </div>

      <CompletaConfiguracion onImportado={loadPacientes} />

      {plus !== null && (
        <button
          type="button"
          onClick={() => (plus ? router.push("/dashboard/configuracion/boletas") : (setUpsellOrigen("dashboard"), setUpsell(true)))}
          className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-left text-sm font-medium hover:border-primary"
        >
          <Receipt className="h-4 w-4 text-primary" />
          {plus && boletasConfiguradas ? "Boletas activas" : "Configurar boleta de honorarios"}
        </button>
      )}

      <ResumenCobros />
      <UpsellPlusModal open={upsell} onOpenChange={setUpsell} origen={upsellOrigen} enPrueba={enPrueba} />

      {/* ── Filtros ── */}
      <div className="space-y-3">
        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as string)}>
          <TabsList aria-label="Filtrar por estado">
            <TabsTrigger value="ALL">
              Todos <span className="text-xs text-muted-foreground">{counts.ALL}</span>
            </TabsTrigger>
            {PATIENT_STATUS_OPTIONS.map((status) => (
              <TabsTrigger key={status.value} value={status.value}>
                {status.label} <span className="text-xs text-muted-foreground">{counts[status.value] || 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Buscar pacientes"
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {(plus === false || conDeuda > 0 || soloDeudores) && (
            <Button
              variant={soloDeudores ? "default" : "outline"}
              size="sm"
              aria-pressed={soloDeudores}
              onClick={() => (plus === false ? (setUpsellOrigen("lista_pacientes"), setUpsell(true)) : setSoloDeudores((v) => !v))}
              className="self-start sm:self-auto"
            >
              {plus === false && <Lock className="h-3.5 w-3.5" />}
              Con pagos pendientes {plus !== false && <span className="text-xs opacity-80">{conDeuda}</span>}
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Label htmlFor="orden-pacientes" className="shrink-0 text-sm text-muted-foreground">Ordenar por</Label>
            <NativeSelect id="orden-pacientes" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-44">
              <option value="nombre">Nombre</option>
              <option value="ultima_sesion">Última sesión</option>
              <option value="proxima_cita">Próxima cita</option>
              {(conDeuda > 0 || sort === "deuda") && <option value="deuda">Monto adeudado</option>}
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <TableSkeleton />
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Error al cargar pacientes</AlertTitle>
          <AlertDescription>
            <p>{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadPacientes} className="mt-3 gap-1.5">
              <RotateCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          {hasFilters ? (
            <>
              <h2 className="text-base font-semibold text-foreground">Sin resultados</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Ningún paciente coincide con la búsqueda o el filtro seleccionado.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setStatusFilter("ALL"); setSoloDeudores(false); }}>
                Limpiar filtros
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground">Aún no tienes pacientes</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Registra tu primer paciente para comenzar a gestionar sus sesiones.</p>
              <Button size="sm" className="mt-4 gap-2" onClick={() => { resetForm(); setShowForm(true); }}>
                <UserPlus className="h-4 w-4" />
                Nuevo paciente
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* ── Móvil: tarjetas ── */}
          <ul className="space-y-2 md:hidden">
            {pageItems.map((p) => (
              <li key={p.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0 rounded-lg border border-border/70">
                    <AvatarFallback className="rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                      {getInitials(p.nombre, p.apellido)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/pacientes/${p.id}`} className="block truncate text-sm font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none">
                      {p.nombre_completo}
                    </Link>
                    <PacienteMeta paciente={p} />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge estado={p.estado} />
                      <DeudaBadge paciente={p} bloqueado={plus === false} onBloqueo={() => { setUpsellOrigen("lista_pacientes"); setUpsell(true); }} />
                      {(tieneRiesgo(p) || p.es_menor_edad) && <AlertChips paciente={p} />}
                    </div>
                  </div>
                  <PatientActionsMenu {...menuProps(p)} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Última sesión</dt>
                    <dd className="mt-0.5 text-foreground">{formatDateCL(p.ultima_sesion) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Próxima cita</dt>
                    <dd className="mt-0.5 text-foreground">{formatDateCL(p.proxima_cita, true) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Consentimiento</dt>
                    <dd className="mt-0.5"><ConsentimientoText estado={p.consentimiento_estado} papel={p.consentimiento_papel_fecha} /></dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* ── Escritorio: tabla ── */}
          <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Paciente</TableHead>
                  <TableHead>Última sesión</TableHead>
                  <TableHead>Próxima cita</TableHead>
                  <TableHead>Consentimiento</TableHead>
                  <TableHead>Alerta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".row-action, a")) return;
                      openFicha(p);
                    }}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0 rounded-lg border border-border/70">
                          <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                            {getInitials(p.nombre, p.apellido)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link href={`/dashboard/pacientes/${p.id}`} className="block truncate font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none">
                            {p.nombre_completo}
                          </Link>
                          <PacienteMeta paciente={p} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateCL(p.ultima_sesion) || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateCL(p.proxima_cita, true) || "—"}</TableCell>
                    <TableCell><ConsentimientoText estado={p.consentimiento_estado} papel={p.consentimiento_papel_fecha} /></TableCell>
                    <TableCell><AlertChips paciente={p} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge estado={p.estado} />
                        <DeudaBadge paciente={p} bloqueado={plus === false} onBloqueo={() => { setUpsellOrigen("lista_pacientes"); setUpsell(true); }} />
                      </div>
                    </TableCell>
                    <TableCell className="row-action pr-4 text-right">
                      <PatientActionsMenu {...menuProps(p)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ── Paginación ── */}
          <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
            <p>
              {filtered.length === 1
                ? "1 paciente"
                : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} de ${filtered.length} pacientes`}
            </p>
            {totalPages > 1 && (
              <nav className="flex items-center gap-2" aria-label="Paginación">
                <Button variant="outline" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span aria-live="polite">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className="gap-1">
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            )}
          </div>
        </>
      )}

      {/* ── Alta rápida ── */}
      <Sheet open={showForm} onOpenChange={(open) => { if (!saving) setShowForm(open); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nuevo paciente</SheetTitle>
            <SheetDescription>Completa lo esencial ahora; el resto puedes agregarlo después en la ficha.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-1 flex-col gap-4">
            {formError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-nombre">Nombre *</Label>
                <Input id="np-nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Sofía" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-apellido">Apellido *</Label>
                <Input id="np-apellido" required value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Ej. Martínez" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-rut">RUT</Label>
              <Input
                id="np-rut"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                onBlur={() => rut.trim() && setRut(formatRut(rut))}
                placeholder="12.345.678-9"
                aria-invalid={Boolean(rut.trim()) && !isValidRut(rut) && rut.replace(/[^0-9kK]/g, "").length >= 8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-motivo">Motivo de consulta</Label>
              <Textarea id="np-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: manejo de estrés laboral, duelo..." />
            </div>

            <details className="group rounded-lg border border-border/70">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-foreground marker:text-muted-foreground">
                Más datos (opcional)
              </summary>
              <div className="grid grid-cols-2 gap-3 border-t border-border/70 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="np-fecha">Fecha de nacimiento</Label>
                  <Input id="np-fecha" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-edad">Edad</Label>
                  <Input id="np-edad" type="number" min={0} max={120} value={edad} onChange={(e) => setEdad(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-sexo">Sexo</Label>
                  <NativeSelect id="np-sexo" value={sexo} onChange={(e) => setSexo(e.target.value)}>
                    <option value="N">Prefiero no decir</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-ocupacion">Ocupación</Label>
                  <Input id="np-ocupacion" value={ocupacion} onChange={(e) => setOcupacion(e.target.value)} placeholder="Ej: Docente" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="np-email">Correo de contacto</Label>
                  <Input id="np-email" type="email" value={emailContacto} onChange={(e) => setEmailContacto(e.target.value)} placeholder="paciente@correo.com" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="np-whatsapp">WhatsApp</Label>
                  <Input id="np-whatsapp" type="tel" value={telefonoWhatsapp} onChange={(e) => setTelefonoWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" />
                </div>
              </div>
            </details>

            <SheetFooter className="mt-auto pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !nombre.trim() || !apellido.trim()} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Guardar paciente"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

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
