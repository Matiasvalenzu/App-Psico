"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUser,
  listUsers,
  getAdminSystemStats,
  apiFetch,
  updateUserSubscription,
  deleteUser,
} from "@/lib/api";
import {
  ShieldCheck,
  UserCog,
  KeyRound,
  Loader2,
  X,
  Users,
  CreditCard,
  UserCheck,
  Mic,
  Sparkles,
  Trash2,
  CalendarClock,
  Search,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  Plus,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { ClientPortal } from "@/components/ui/ClientPortal";

interface SystemUserSubscription {
  estado: string;
  is_active_or_trial: boolean;
  fin_prueba: string | null;
  dias_restantes_prueba: number | null;
  card_last_four: string;
  card_brand: string;
  proximo_cobro: string | null;
  has_mp_preapproval: boolean;
}

interface SystemUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  pacientes_count: number;
  sesiones_count: number;
  audio_segundos_total: number;
  audio_minutos_total: number;
  audio_horas_total: number;
  tokens_ia_total: number;
  costo_ia_total_usd: number;
  suscripcion: SystemUserSubscription;
}

interface AdminSystemStats {
  total_usuarios: number;
  usuarios_activos_mes: number;
  total_pacientes: number;
  total_sesiones: number;
  total_audio_horas: number;
  total_tokens_ia: number;
  total_costo_ia_usd: number;
  suscripciones_activas: number;
  suscripciones_trial: number;
  suscripciones_canceladas: number;
}

function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function fullName(user: SystemUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Sin nombre";
}

function formatTokens(count: number) {
  if (!count) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toLocaleString();
}

function formatAudio(segundos: number) {
  if (!segundos) return "0m";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  if (horas > 0) {
    return `${horas}h ${minutos}m`;
  }
  return `${minutos}m`;
}

function formatUSD(usd: number) {
  if (!usd || usd === 0) return "$0.00";
  if (usd < 0.01) return `< $0.01`;
  return `$${usd.toFixed(2)}`;
}

export default function UsuariosPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [stats, setStats] = useState<AdminSystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters and search
  const [search, setSearch] = useState("");
  const [filterSubscription, setFilterSubscription] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");

  // Modal Cambiar Clave
  const [changePasswordUser, setChangePasswordUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Modal Gestionar Suscripción
  const [manageSubUser, setManageSubUser] = useState<SystemUser | null>(null);
  const [subEstado, setSubEstado] = useState("trial");
  const [subDiasAdicionales, setSubDiasAdicionales] = useState<number | "">("");
  const [managingSub, setManagingSub] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState("");

  // Modal Borrado Total Seguro
  const [deleteTargetUser, setDeleteTargetUser] = useState<SystemUser | null>(null);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([
        listUsers(),
        getAdminSystemStats().catch(() => null),
      ]);
      setUsers(usersData);
      if (statsData) setStats(statsData);
    } catch (err: any) {
      console.error(err);
      setError("No se pudieron cargar los datos de usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser.is_superuser !== true) {
          router.replace("/dashboard");
          return;
        }
        setCurrentAdminId(currentUser.id);
        setChecking(false);
        await loadData();
      } catch (err) {
        console.error(err);
        router.replace("/dashboard");
      }
    }
    init();
  }, [router]);

  // Handlers
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!changePasswordUser || !newPassword) return;

    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      const res = await apiFetch(`/auth/users/${changePasswordUser.id}/password/`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        let message = "Error al cambiar la contraseña.";
        try {
          const data = await res.json();
          message = data.detail || message;
        } catch {}
        throw new Error(message);
      }

      setPasswordSuccess("Contraseña actualizada exitosamente.");
      setNewPassword("");
      setTimeout(() => {
        setChangePasswordUser(null);
        setPasswordSuccess("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || "Error al cambiar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleUpdateSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!manageSubUser) return;

    setManagingSub(true);
    setSubError("");
    setSubSuccess("");

    try {
      const payload: { dias_adicionales_prueba?: number; estado?: string } = {
        estado: subEstado,
      };
      if (typeof subDiasAdicionales === "number" && subDiasAdicionales > 0) {
        payload.dias_adicionales_prueba = subDiasAdicionales;
      }

      const res = await updateUserSubscription(manageSubUser.id, payload);
      setSubSuccess(res.detail || "Suscripción actualizada exitosamente.");

      // Actualizar localmente el usuario
      setUsers((prev) =>
        prev.map((u) =>
          u.id === manageSubUser.id ? { ...u, suscripcion: res.suscripcion } : u
        )
      );

      // Recargar stats en segundo plano
      getAdminSystemStats().then((data) => setStats(data)).catch(() => {});

      setTimeout(() => {
        setManageSubUser(null);
        setSubSuccess("");
      }, 1500);
    } catch (err: any) {
      setSubError(err.message || "Error al actualizar la suscripción.");
    } finally {
      setManagingSub(false);
    }
  }

  async function handleDeleteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteTargetUser) return;
    if (confirmUsername.trim() !== deleteTargetUser.username) {
      setDeleteError("El nombre de usuario ingresado no coincide.");
      return;
    }

    setDeletingUser(true);
    setDeleteError("");

    try {
      await deleteUser(deleteTargetUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTargetUser.id));
      getAdminSystemStats().then((data) => setStats(data)).catch(() => {});
      setDeleteTargetUser(null);
      setConfirmUsername("");
    } catch (err: any) {
      setDeleteError(err.message || "Error al eliminar el usuario.");
    } finally {
      setDeletingUser(false);
    }
  }

  // Filtered & Sorted users
  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matches =
            user.username.toLowerCase().includes(q) ||
            user.email?.toLowerCase().includes(q) ||
            fullName(user).toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Subscription filter
        if (filterSubscription !== "all") {
          const st = user.suscripcion?.estado || "trial";
          if (filterSubscription === "trial" && st !== "trial") return false;
          if (filterSubscription === "activa" && st !== "activa") return false;
          if (
            filterSubscription === "cancelada" &&
            !["cancelada", "expirada", "past_due"].includes(st)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "tokens_desc") {
          return (b.tokens_ia_total || 0) - (a.tokens_ia_total || 0);
        }
        if (sortBy === "pacientes_desc") {
          return (b.pacientes_count || 0) - (a.pacientes_count || 0);
        }
        if (sortBy === "audio_desc") {
          return (b.audio_segundos_total || 0) - (a.audio_segundos_total || 0);
        }
        if (sortBy === "name_asc") {
          return fullName(a).localeCompare(fullName(b));
        }
        // Default: date_desc
        return new Date(b.date_joined).getTime() - new Date(a.date_joined).getTime();
      });
  }, [users, search, filterSubscription, sortBy]);

  if (checking) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administración de Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Métricas de uso clínico, consumo de tokens IA, gestión de suscripciones y control de cuentas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/usuarios/crear"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Crear Usuario
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPIs Globales Superiores ── */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Usuarios */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Cuentas Totales</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {stats.total_usuarios}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {stats.usuarios_activos_mes} activas últ. 30 días
            </div>
          </div>

          {/* Suscripciones */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Suscripciones</span>
              <CreditCard className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.suscripciones_activas}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">pagadas</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stats.suscripciones_trial} en periodo de prueba
            </div>
          </div>

          {/* Pacientes & Sesiones */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Volumen Clínico</span>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {stats.total_pacientes}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">pacientes</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stats.total_sesiones} sesiones registradas
            </div>
          </div>

          {/* Horas de Audio */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Audio Procesado</span>
              <Mic className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {stats.total_audio_horas}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">hrs</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Whisper & Diarización
            </div>
          </div>

          {/* Consumo IA */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Consumo Tokens IA</span>
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatTokens(stats.total_tokens_ia)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground font-medium">
              Costo est: ~${stats.total_costo_ia_usd.toFixed(4)} USD
            </div>
          </div>
        </div>
      )}

      {/* ── Filtros y Buscador ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por usuario, nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-background/50 pl-9 pr-8 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Suscripción */}
          <select
            value={filterSubscription}
            onChange={(e) => setFilterSubscription(e.target.value)}
            className="rounded-xl border border-input bg-background/50 px-3 py-2 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">Suscripción: Todas</option>
            <option value="trial">Suscripción: Periodo de prueba</option>
            <option value="activa">Suscripción: Activas (Pagadas)</option>
            <option value="cancelada">Suscripción: Canceladas / Expiradas</option>
          </select>

          {/* Ordenar por */}
          <div className="flex items-center gap-1.5 rounded-xl border border-input bg-background/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Más recientes primero</option>
              <option value="tokens_desc">Mayor consumo tokens IA</option>
              <option value="pacientes_desc">Más pacientes creados</option>
              <option value="audio_desc">Más horas de audio</option>
              <option value="name_asc">Nombre (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Tabla Principal de Usuarios ── */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-3 text-sm text-muted-foreground flex items-center justify-between bg-muted/20">
          <div>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios...
              </span>
            ) : (
              <span>
                Mostrando <strong>{filteredUsers.length}</strong> de{" "}
                <strong>{users.length}</strong> usuarios registrados
              </span>
            )}
          </div>
        </div>

        {!loading && filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <UserCog className="h-12 w-12 opacity-40" />
            <p className="font-medium">No se encontraron usuarios con los filtros aplicados.</p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs text-primary hover:underline mt-1"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5">Usuario & Nombre</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Suscripción</th>
                  <th className="px-4 py-3.5 text-center">Pacientes</th>
                  <th className="px-4 py-3.5 text-center">Audio</th>
                  <th className="px-4 py-3.5 text-right">Tokens IA (USD)</th>
                  <th className="px-4 py-3.5">Último Acceso</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((user) => {
                  const sub = user.suscripcion || { estado: "trial" };
                  const isTrial = sub.estado === "trial";
                  const isActiva = sub.estado === "activa";
                  const isCancelada = ["cancelada", "expirada", "past_due"].includes(sub.estado);

                  return (
                    <tr key={user.id} className="hover:bg-muted/40 transition-colors">
                      {/* Usuario & Nombre */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs uppercase">
                            {user.first_name ? user.first_name[0] : user.username[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground text-sm">
                                {user.username}
                              </span>
                              {user.is_superuser && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  <ShieldCheck className="h-3 w-3" /> Superuser
                                </span>
                              )}
                              {!user.is_superuser && user.is_staff && (
                                <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                  Staff
                                </span>
                              )}
                              {!user.is_active && (
                                <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {fullName(user)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {user.email ? (
                          <span className="truncate block max-w-[180px]">{user.email}</span>
                        ) : (
                          <span className="opacity-40">-</span>
                        )}
                      </td>

                      {/* Suscripción */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isActiva && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Activa
                              {sub.card_last_four && (
                                <span className="text-[10px] opacity-80">
                                  • {sub.card_brand || "TC"} {sub.card_last_four}
                                </span>
                              )}
                            </span>
                          )}
                          {isTrial && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <Clock className="h-3 w-3" /> Prueba
                              {sub.dias_restantes_prueba !== null && (
                                <span>({sub.dias_restantes_prueba}d)</span>
                              )}
                            </span>
                          )}
                          {isCancelada && (
                            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                              {sub.estado === "cancelada"
                                ? "Cancelada"
                                : sub.estado === "expirada"
                                ? "Expirada"
                                : "Atrasada"}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setManageSubUser(user);
                              setSubEstado(user.suscripcion?.estado || "trial");
                              setSubDiasAdicionales("");
                              setSubError("");
                              setSubSuccess("");
                            }}
                            className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 mt-0.5"
                          >
                            <CalendarClock className="h-3 w-3" /> Gestionar
                          </button>
                        </div>
                      </td>

                      {/* Pacientes */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold">
                          {user.pacientes_count || 0}
                        </span>
                      </td>

                      {/* Audio */}
                      <td className="px-4 py-4 text-center text-xs font-medium text-muted-foreground">
                        {user.audio_segundos_total > 0 ? (
                          <span>{formatAudio(user.audio_segundos_total)}</span>
                        ) : (
                          <span className="opacity-40">0m</span>
                        )}
                      </td>

                      {/* Tokens IA */}
                      <td className="px-4 py-4 text-right">
                        <div className="font-semibold text-xs text-foreground">
                          {formatTokens(user.tokens_ia_total)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatUSD(user.costo_ia_total_usd)}
                        </div>
                      </td>

                      {/* Último Acceso */}
                      <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(user.last_login)}
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Cambiar Clave */}
                          <button
                            type="button"
                            title="Cambiar contraseña"
                            onClick={() => {
                              setChangePasswordUser(user);
                              setNewPassword("");
                              setPasswordError("");
                              setPasswordSuccess("");
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          {/* Borrar Usuario */}
                          <button
                            type="button"
                            title={
                              user.id === currentAdminId
                                ? "No puedes eliminar tu propia cuenta"
                                : "Eliminar usuario permanentemente"
                            }
                            disabled={user.id === currentAdminId}
                            onClick={() => {
                              setDeleteTargetUser(user);
                              setConfirmUsername("");
                              setDeleteError("");
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal 1: Cambiar Contraseña ── */}
      {changePasswordUser && (
        <ClientPortal>
          <div
            className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-6 shadow-elevated animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Cambiar contraseña</h2>
              </div>
              <button
                type="button"
                onClick={() => setChangePasswordUser(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ingresa la nueva contraseña para <strong>{changePasswordUser.username}</strong>.
            </p>

            {passwordError && (
              <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                  autoFocus
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePasswordUser(null)}
                  disabled={changingPassword}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !newPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Actualizar clave
                </button>
              </div>
            </form>
          </div>
        </ClientPortal>
      )}

      {/* ── Modal 2: Gestionar Suscripción ── */}
      {manageSubUser && (
        <ClientPortal>
          <div
            className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-elevated animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Gestionar Suscripción</h2>
              </div>
              <button
                type="button"
                onClick={() => setManageSubUser(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Modifica el periodo o estado de acceso para{" "}
              <strong>{manageSubUser.username}</strong> ({fullName(manageSubUser)}).
            </p>

            {subError && (
              <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                {subError}
              </div>
            )}

            {subSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                {subSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateSubscription} className="space-y-4">
              {/* Estado */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estado de Suscripción
                </label>
                <select
                  value={subEstado}
                  onChange={(e) => setSubEstado(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="trial">Periodo de Prueba (Trial)</option>
                  <option value="activa">Activa (Cortesía o Pagada)</option>
                  <option value="past_due">Atrasada / Pago pendiente</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="expirada">Expirada</option>
                </select>
              </div>

              {/* Extensión de días de prueba */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Extender periodo de prueba (días adicionales)
                </label>
                <div className="flex items-center gap-2 mb-2">
                  {[7, 15, 30].map((dias) => (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => setSubDiasAdicionales(dias)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all ${
                        subDiasAdicionales === dias
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      +{dias} días
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={subDiasAdicionales}
                  onChange={(e) =>
                    setSubDiasAdicionales(
                      e.target.value === "" ? "" : parseInt(e.target.value, 10)
                    )
                  }
                  placeholder="O ingresa un número de días..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {manageSubUser.suscripcion?.has_mp_preapproval && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ Este usuario posee una suscripción activa con débito automático en Mercado Pago.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManageSubUser(null)}
                  disabled={managingSub}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={managingSub}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {managingSub && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </ClientPortal>
      )}

      {/* ── Modal 3: Borrado Total Seguro (Hard Delete) ── */}
      {deleteTargetUser && (
        <ClientPortal>
          <div
            className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-elevated animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                <h2 className="text-lg font-bold">Eliminar Usuario Permanentemente</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-sm text-foreground">
                Estás a punto de eliminar definitivamente la cuenta de{" "}
                <strong className="text-destructive font-bold">{deleteTargetUser.username}</strong>{" "}
                ({deleteTargetUser.email || fullName(deleteTargetUser)}).
              </p>

              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive space-y-1.5">
                <p className="font-semibold">⚠️ Acción Irreversible y Borrado Completo:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Se borrarán todos sus pacientes ({deleteTargetUser.pacientes_count}).</li>
                  <li>Se destruirán todas las grabaciones y archivos de audio en disco.</li>
                  <li>Se eliminarán historiales de chat, evaluaciones y notas clínicas.</li>
                  {deleteTargetUser.suscripcion?.has_mp_preapproval && (
                    <li className="font-bold">
                      Se cancelará de inmediato su suscripción en Mercado Pago para frenar cobros.
                    </li>
                  )}
                  <li>Si el usuario desea ingresar de nuevo, tendrá que partir desde cero.</li>
                </ul>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-xl bg-destructive/15 p-3 text-xs text-destructive font-medium">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteUser} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Para confirmar, escribe exactamente{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-bold text-destructive">
                    {deleteTargetUser.username}
                  </code>
                  :
                </label>
                <input
                  type="text"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder={deleteTargetUser.username}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetUser(null)}
                  disabled={deletingUser}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    deletingUser || confirmUsername.trim() !== deleteTargetUser.username
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-subtle transition-all hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deletingUser && <Loader2 className="h-4 w-4 animate-spin" />}
                  Eliminar completamente
                </button>
              </div>
            </form>
          </div>
        </ClientPortal>
      )}
    </div>
  );
}
