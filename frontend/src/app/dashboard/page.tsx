"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Loader2, Plus, Search, UserPlus, X } from "lucide-react";

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  activo: boolean;
  updated_at: string;
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

export default function DashboardPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
        body: JSON.stringify({ nombre, apellido, motivo_consulta: motivo }),
      });
      if (!res.ok) throw new Error();
      const nuevo = await res.json();
      setPacientes((prev) => [nuevo, ...prev]);
      setShowForm(false);
      setNombre("");
      setApellido("");
      setMotivo("");
      setSuccess("Paciente creado correctamente.");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("No se pudo guardar el paciente.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = pacientes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.apellido.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando pacientes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pacientes.length} paciente{pacientes.length !== 1 ? "s" : ""} registrado{pacientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(!showForm);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo paciente
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Registrar paciente</h2>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Nombre
                </label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Nombre del paciente"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Apellido
                </label>
                <input
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Apellido del paciente"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Motivo de consulta
              </label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Ej: Ansiedad generalizada, depresión..."
              />
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Guardar paciente"}
              </button>
            </div>
          </form>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Plus className="h-3 w-3 rotate-45" />
          </div>
          {success}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-4 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          placeholder="Buscar por nombre o apellido..."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center shadow-subtle">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Sin pacientes registrados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu primer paciente para comenzar
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((paciente) => (
            <button
              key={paciente.id}
              onClick={() =>
                router.push(`/dashboard/pacientes/${paciente.id}`)
              }
              className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left shadow-subtle transition-all hover:border-primary/30 hover:shadow-card hover:-translate-y-0.5"
            >
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${getAvatarColor(paciente.nombre_completo)}`}
              >
                {getInitials(paciente.nombre, paciente.apellido)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {paciente.nombre_completo}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Actualizado {formatDate(paciente.updated_at)}
                </p>
              </div>
              <div className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:text-primary">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
