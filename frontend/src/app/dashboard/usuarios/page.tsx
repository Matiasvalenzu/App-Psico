"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Loader2, Plus } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import {
  exportarUsuarios,
  formatFechaSantiago,
  formatUsd,
  getAdminUsuarios,
  haceDias,
  type AdminUsuarioFila,
} from "@/lib/admin";

const ESTADOS = [
  { value: "", label: "Estado: todos" },
  { value: "trial", label: "Prueba" },
  { value: "activa", label: "Pagado" },
  { value: "past_due", label: "Pago fallido" },
  { value: "cancelada", label: "Cancelada" },
  { value: "expirada", label: "Expirada" },
];

export default function UsuariosPage() {
  const [rows, setRows] = useState<AdminUsuarioFila[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [plan, setPlan] = useState("");
  const [origen, setOrigen] = useState("");
  const [inactivos, setInactivos] = useState(false);
  const [porVencer, setPorVencer] = useState(false);
  const [ordering, setOrdering] = useState("-registro");

  const filtros = { q, estado, plan, origen, inactivos, prueba_por_vencer: porVencer, ordering, page };

  useEffect(() => {
    let activo = true;
    setLoading(true);
    getAdminUsuarios(filtros)
      .then((data) => {
        if (!activo) return;
        setRows(data.results);
        setPages(data.pages);
        setCount(data.count);
        setError("");
      })
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, [q, estado, plan, origen, inactivos, porVencer, ordering, page]);

  function toggleSort(key: string) {
    setPage(1);
    setOrdering((current) => (current === `-${key}` ? key : `-${key}`));
  }

  return (
    <AdminShell title="Usuarios" description="Cuentas, plan y conteos. Sin nombres de pacientes ni notas.">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/usuarios/crear" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Crear usuario
        </Link>
        <button
          type="button"
          onClick={() => exportarUsuarios({ q, estado, plan, origen, inactivos, prueba_por_vencer: porVencer, ordering }).catch((err) => setError(err.message))}
          className="rounded-xl border px-4 py-2 text-sm"
        >
          Exportar CSV
        </button>
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/70 bg-card p-4 md:grid-cols-3">
        <input
          aria-label="Buscar por email o nombre"
          value={q}
          onChange={(event) => { setPage(1); setQ(event.target.value); }}
          placeholder="Email o nombre"
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        />
        <select aria-label="Estado" value={estado} onChange={(event) => { setPage(1); setEstado(event.target.value); }} className="rounded-xl border bg-background px-3 py-2 text-sm">
          {ESTADOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select aria-label="Plan" value={plan} onChange={(event) => { setPage(1); setPlan(event.target.value); }} className="rounded-xl border bg-background px-3 py-2 text-sm">
          <option value="">Plan: todos</option>
          <option value="estandar">Estándar</option>
          <option value="plus">Plus</option>
        </select>
        <input aria-label="Origen" value={origen} onChange={(event) => { setPage(1); setOrigen(event.target.value); }} placeholder="Origen (o desconocido)" className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inactivos} onChange={(event) => { setPage(1); setInactivos(event.target.checked); }} />
          Inactivos &gt; 14 días
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={porVencer} onChange={(event) => { setPage(1); setPorVencer(event.target.checked); }} />
          Prueba por vencer
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando</span> : `${count} cuentas`}
        </div>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th label="Nombre" onClick={() => toggleSort("nombre")} />
              <Th label="Email" onClick={() => toggleSort("email")} />
              <Th label="Registro" onClick={() => toggleSort("registro")} />
              <Th label="Actividad" onClick={() => toggleSort("actividad")} />
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Plan</th>
              <Th label="Prueba" onClick={() => toggleSort("prueba")} />
              <Th label="Próximo cobro" onClick={() => toggleSort("cobro")} />
              <th className="px-3 py-3">Tarjeta</th>
              <Th label="Sesiones mes" onClick={() => toggleSort("sesiones")} />
              <Th label="Audio" onClick={() => toggleSort("audio")} />
              <Th label="Tokens IA" onClick={() => toggleSort("tokens")} />
              <Th label="Costo IA" onClick={() => toggleSort("costo")} />
              <th className="px-3 py-3">Origen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t border-border/60 hover:bg-muted/40">
                <td className="px-3 py-3">
                  <Link href={`/dashboard/admin/usuarios/${user.id}`} className="font-medium hover:underline">{user.nombre || user.username}</Link>
                  <div className="text-xs text-muted-foreground">{user.username}</div>
                </td>
                <td className={`px-3 py-3 text-xs ${user.email_duplicado ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                  {user.email || "—"}
                  {user.email_duplicado && <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px]">duplicado</span>}
                </td>
                <td className="px-3 py-3 text-xs">{formatFechaSantiago(user.date_joined)}</td>
                <td className="px-3 py-3 text-xs">{haceDias(user.ultima_actividad)}</td>
                <td className="px-3 py-3 text-xs">{user.exenta ? "Exenta" : user.suscripcion.estado_visible}</td>
                <td className="px-3 py-3 text-xs">{user.suscripcion.plan}</td>
                <td className="px-3 py-3 text-xs">{user.suscripcion.dias_restantes_prueba ?? "—"}</td>
                <td className="px-3 py-3 text-xs">{formatFechaSantiago(user.suscripcion.proximo_cobro)}</td>
                <td className="px-3 py-3 text-xs">{user.suscripcion.card_last_four ? `${user.suscripcion.card_brand || "TC"} ···· ${user.suscripcion.card_last_four}` : "—"}</td>
                <td className="px-3 py-3 text-xs">{user.sesiones_mes}</td>
                <td className="px-3 py-3 text-xs">{user.audio_minutos_total.toFixed(1)} min</td>
                <td className="px-3 py-3 text-xs">{user.tokens_ia_total.toLocaleString("es-CL")}</td>
                <td className="px-3 py-3 text-xs">{formatUsd(user.costo_ia_total_usd)}</td>
                <td className="px-3 py-3 text-xs">{user.origen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button>
        <span>Página {page} de {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Siguiente</button>
      </div>
    </AdminShell>
  );
}

function Th({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th className="px-3 py-3">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
