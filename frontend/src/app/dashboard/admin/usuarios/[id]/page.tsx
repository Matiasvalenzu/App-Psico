"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { deleteUser, updateUserSubscription } from "@/lib/api";
import {
  formatClp,
  formatFechaSantiago,
  formatUsd,
  getAdminUsuario,
  marcarCuentaInterna,
  type AdminUsuarioDetalle,
} from "@/lib/admin";

export default function UsuarioDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [data, setData] = useState<AdminUsuarioDetalle | null>(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState("estandar");
  const [estado, setEstado] = useState("trial");
  const [dias, setDias] = useState("");
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  async function cargar() {
    const detalle = await getAdminUsuario(id);
    setData(detalle);
    setPlan(detalle.cuenta.suscripcion.plan);
    setEstado(detalle.cuenta.suscripcion.estado);
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    cargar().catch((err) => setError(err.message));
  }, [id]);

  if (!data) {
    return <AdminShell title="Usuario">{error || "Cargando…"}</AdminShell>;
  }

  const cuenta = data.cuenta;

  async function guardarPlan(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await updateUserSubscription(id, {
        plan,
        estado,
        ...(dias ? { dias_adicionales_prueba: Number(dias) } : {}),
      });
      setDias("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  async function guardarClave(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm("¿Cambiar la clave de esta cuenta?")) return;
    const { apiFetch } = await import("@/lib/api");
    const res = await apiFetch(`/auth/users/${id}/password/`, {
      method: "POST",
      body: JSON.stringify({ password: clave }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.detail || "No se pudo cambiar la clave.");
      return;
    }
    setClave("");
  }

  async function eliminar(event: React.FormEvent) {
    event.preventDefault();
    if (confirmacion !== cuenta.username) {
      setError("El usuario no coincide.");
      return;
    }
    if (!window.confirm("Esta acción borra la cuenta y no se puede deshacer.")) return;
    await deleteUser(id);
    router.push("/dashboard/usuarios");
  }

  return (
    <AdminShell title={cuenta.nombre || cuenta.username} description={cuenta.email}>
      <Link href="/dashboard/usuarios" className="text-sm text-primary hover:underline">Volver a usuarios</Link>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <section className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm md:grid-cols-2">
        <p>Registro: {formatFechaSantiago(cuenta.date_joined, true)}</p>
        <p>Último acceso: {formatFechaSantiago(cuenta.last_login, true)}</p>
        <p>Última actividad: {formatFechaSantiago(cuenta.ultima_actividad, true)}</p>
        <p>Origen: {cuenta.origen}</p>
        <p>Estado: {cuenta.exenta ? "Exenta" : cuenta.suscripcion.estado_visible}</p>
        <p>Plan: {cuenta.suscripcion.plan} · {formatClp(cuenta.suscripcion.monto_mensual_clp)}/mes</p>
        <p>Tarjeta: {cuenta.suscripcion.card_last_four ? `${cuenta.suscripcion.card_brand} ···· ${cuenta.suscripcion.card_last_four}` : "—"}</p>
        <p>Próximo cobro: {formatFechaSantiago(cuenta.suscripcion.proximo_cobro)}</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cuenta.es_interna}
            onChange={(event) => marcarCuentaInterna(id, event.target.checked).then(cargar).catch((err) => setError(err.message))}
          />
          Cuenta interna (fuera de métricas)
        </label>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
        <h2 className="mb-2 font-semibold">Suscripción</h2>
        <p>Creada: {formatFechaSantiago(data.historial_suscripcion.creada_en, true)}</p>
        <p>Último cambio: {formatFechaSantiago(data.historial_suscripcion.actualizada_en, true)}</p>
        <p>Cancelada: {formatFechaSantiago(data.historial_suscripcion.cancelada_en, true)}</p>
        <p>Inactiva desde: {formatFechaSantiago(data.historial_suscripcion.inactiva_desde, true)}</p>
        <p className="mt-2 text-xs text-muted-foreground">{data.historial_suscripcion.nota}</p>
        <h3 className="mb-1 mt-4 font-semibold">Mercado Pago</h3>
        <p>Preapproval vinculado: {data.pagos_mercadopago.tiene_preapproval ? "sí" : "no"}</p>
        <p>Próximo cobro: {formatFechaSantiago(data.pagos_mercadopago.proximo_cobro)}</p>
        {data.pagos_mercadopago.plus_vinculados.map((item) => (
          <p key={item.preapproval_id}>Plus vinculado {item.preapproval_id} · {item.estado_mp} · {formatFechaSantiago(item.vinculado_en)}</p>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">{data.pagos_mercadopago.nota}</p>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Mes</th><th>Pacientes</th><th>Sesiones</th><th>Minutos</th><th>Tx ok</th><th>Tx error</th><th>Chat</th><th>Informes</th><th>Tests</th><th>Agenda</th><th>Boletas</th>
            </tr>
          </thead>
          <tbody>
            {data.uso_por_mes.map((item) => (
              <tr key={item.mes} className="border-t border-border/60">
                <td className="px-3 py-2">{item.mes}</td>
                <td>{item.pacientes}</td><td>{item.sesiones}</td><td>{item.minutos_audio.toFixed(1)}</td>
                <td>{item.transcripciones_ok}</td><td>{item.transcripciones_fallidas}</td>
                <td>{item.mensajes_chat}</td><td>{item.informes}</td><td>{item.tests}</td><td>{item.agenda}</td><td>{item.boletas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
        <h2 className="mb-2 font-semibold">Costo IA y pago</h2>
        <p>IA del mes: {formatUsd(data.costo_ia.mes_actual_usd)} · total {formatUsd(data.costo_ia.total_usd)}</p>
        <p>Paga: {formatClp(data.costo_ia.pago_mensual_clp)} / mes</p>
        <p className="text-xs text-muted-foreground">{data.costo_ia.margen_nota}</p>
        <ul className="mt-2 space-y-1">
          {data.costo_ia.por_servicio_modelo.map((item) => (
            <li key={`${item.servicio}-${item.modelo}`}>{item.servicio} · {item.modelo} · {formatUsd(item.costo_usd)}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
        <h2 className="mb-2 font-semibold">Hitos</h2>
        <p>Primer paciente: {formatFechaSantiago(data.hitos.primer_paciente)}</p>
        <p>Primera sesión: {formatFechaSantiago(data.hitos.primera_sesion)}</p>
        <p>Primera transcripción: {formatFechaSantiago(data.hitos.primera_transcripcion)}</p>
        <p>Primera boleta: {formatFechaSantiago(data.hitos.primera_boleta)}</p>
      </section>

      <form onSubmit={guardarPlan} className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 md:grid-cols-4">
        <label className="text-sm">Plan
          <select value={plan} onChange={(event) => setPlan(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1.5">
            <option value="estandar">Estándar</option>
            <option value="plus">Plus</option>
          </select>
        </label>
        <label className="text-sm">Estado
          <select value={estado} onChange={(event) => setEstado(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1.5">
            {["trial", "activa", "past_due", "cancelada", "expirada"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">Días extra de prueba
          <input value={dias} onChange={(event) => setDias(event.target.value)} type="number" min={1} className="mt-1 w-full rounded-lg border px-2 py-1.5" />
        </label>
        <button className="self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Guardar plan</button>
      </form>

      <form onSubmit={guardarClave} className="flex flex-wrap items-end gap-2 rounded-2xl border border-border/70 bg-card p-4">
        <label className="text-sm">Nueva clave
          <input type="password" value={clave} onChange={(event) => setClave(event.target.value)} minLength={8} required className="mt-1 block rounded-lg border px-2 py-1.5" />
        </label>
        <button className="rounded-lg border px-3 py-2 text-sm">Cambiar clave</button>
      </form>

      <form onSubmit={eliminar} className="rounded-2xl border border-destructive/30 bg-card p-4">
        <p className="mb-2 text-sm">Para eliminar, escribe <strong>{cuenta.username}</strong>.</p>
        <input value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} className="mr-2 rounded-lg border px-2 py-1.5 text-sm" aria-label="Confirmar usuario" />
        <button className="rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground">Eliminar cuenta</button>
      </form>
    </AdminShell>
  );
}
