"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Plus, Search, User } from "lucide-react";

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  activo: boolean;
  updated_at: string;
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
      if (!res.ok) {
        setError("No se pudieron cargar los pacientes. Vuelve a iniciar sesión si el problema continúa.");
        setPacientes([]);
        return;
      }
      const data = await res.json();
      setPacientes(data.results || data);
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con el servidor.");
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
          nombre,
          apellido,
          motivo_consulta: motivo,
        }),
      });

      if (!res.ok) {
        setError("No se pudo guardar el paciente. Revisa los datos e intenta nuevamente.");
        return;
      }

      const nuevo = await res.json();
      setPacientes((prev) => [nuevo, ...prev]);
      setShowForm(false);
      setNombre("");
      setApellido("");
      setMotivo("");
      setSuccess("Paciente guardado correctamente.");
      window.setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con el servidor.");
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
    return <p className="text-muted-foreground">Cargando pacientes...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            {pacientes.length} paciente{pacientes.length !== 1 ? "s" : ""} registrado{pacientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(!showForm);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo paciente
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border bg-card p-4 space-y-4"
        >
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Apellido</label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Motivo de consulta</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm mt-1"
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
          {success}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border pl-10 pr-4 py-2 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p>No se encontraron pacientes</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard/pacientes/${p.id}`)}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 text-left hover:border-primary/50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                {p.nombre[0]}
                {p.apellido[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.nombre_completo}</p>
                <p className="text-xs text-muted-foreground">
                  Actualizado {formatDate(p.updated_at)}
                </p>
              </div>
              {!p.activo && (
                <span className="text-xs bg-muted rounded-full px-2 py-0.5">
                  Inactivo
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
