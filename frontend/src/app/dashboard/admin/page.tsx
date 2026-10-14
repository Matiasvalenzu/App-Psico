"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import AdminShell, { StatCard } from "@/components/admin/AdminShell";
import { formatClp, formatFechaSantiago, getAdminResumen, type AdminResumen } from "@/lib/admin";

export default function AdminResumenPage() {
  const [data, setData] = useState<AdminResumen | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminResumen().then(setData).catch((err) => setError(err.message));
  }, []);

  const max = Math.max(1, ...(data?.serie_semanal.flatMap((item) => [item.registros, item.activaciones]) || [1]));

  return (
    <AdminShell title="Resumen" description="Cuentas y uso agregado. Sin contenido clínico.">
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!data ? (
        <p className="text-sm text-muted-foreground">Cargando resumen…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Registros hoy" value={String(data.registros.hoy)} hint={`${data.registros.dias_7} en 7 días · ${data.registros.dias_30} en 30`} />
            <StatCard label="Activos 7 días" value={String(data.activos.dias_7)} hint={`${data.activos.dias_30} en 30 días`} />
            <StatCard label="En prueba" value={String(data.en_prueba)} />
            <StatCard label="MRR" value={formatClp(data.mrr_clp)} hint={`Estándar ${data.pagados_por_plan.estandar?.cuentas || 0} · Plus ${data.pagados_por_plan.plus?.cuentas || 0}`} />
            <StatCard label="Pagados Estándar" value={String(data.pagados_por_plan.estandar?.cuentas || 0)} hint={formatClp(data.pagados_por_plan.estandar?.mrr_clp || 0)} />
            <StatCard label="Pagados Plus" value={String(data.pagados_por_plan.plus?.cuentas || 0)} hint={formatClp(data.pagados_por_plan.plus?.mrr_clp || 0)} />
            <StatCard label="Cancelaciones del mes" value={String(data.cancelaciones_mes)} />
            <StatCard label="Pagos fallidos" value={String(data.pagos_fallidos)} hint="Estado past_due" />
          </div>

          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="text-sm font-semibold">Registros y activaciones por semana</h2>
            <p className="mb-4 text-xs text-muted-foreground">Activación = primer paciente creado. Últimas 12 semanas.</p>
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {data.serie_semanal.map((item) => (
                <div key={item.semana} className="flex min-w-14 flex-1 flex-col items-center gap-1">
                  <div className="flex h-28 items-end gap-1">
                    <div className="w-2 rounded-sm bg-primary" style={{ height: `${(item.registros / max) * 100}%` }} title={`${item.registros} registros`} />
                    <div className="w-2 rounded-sm bg-emerald-500" style={{ height: `${(item.activaciones / max) * 100}%` }} title={`${item.activaciones} activaciones`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{item.semana.slice(5)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Azul: registros. Verde: activaciones.</p>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <Alerta titulo="Prueba vence en 3 días" vacio="Nadie con la prueba por vencer.">
              {data.alertas.prueba_por_vencer.map((item) => (
                <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                  {item.nombre || item.email} · {item.dias} días · {formatFechaSantiago(item.fin_prueba)}
                </Link>
              ))}
            </Alerta>
            <Alerta titulo="Prueba sin primer paciente" vacio="Nadie lleva 3 días de prueba sin paciente.">
              {data.alertas.prueba_sin_paciente.map((item) => (
                <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                  {item.nombre || item.email}
                </Link>
              ))}
            </Alerta>
            <Alerta titulo="Paga y no entra hace 14 días" vacio="Nadie en este grupo.">
              {data.alertas.pagando_sin_entrar.map((item) => (
                <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                  {item.nombre || item.email}
                </Link>
              ))}
            </Alerta>
            <Alerta titulo="Pago fallido" vacio="Sin pagos fallidos.">
              {data.alertas.pago_fallido.map((item) => (
                <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                  {item.nombre || item.email}
                </Link>
              ))}
            </Alerta>
            <Alerta titulo="Plus pagado sin vincular" vacio="Sin pagos Plus pendientes.">
              {data.alertas.plus_sin_vincular.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.preapproval_id} · {item.estado_mp || "sin estado"} · {formatFechaSantiago(item.creado_en)}
                </p>
              ))}
            </Alerta>
            <Alerta titulo="Transcripciones fallidas 24 h" vacio="Sin fallos en 24 h.">
              <p className="text-sm font-medium">Total: {data.alertas.transcripciones_fallidas_24h.total}</p>
              {data.alertas.transcripciones_fallidas_24h.por_profesional.map((item) => (
                <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                  {item.nombre || item.email} · {item.cantidad}
                </Link>
              ))}
            </Alerta>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Registros y pagos por origen</h2>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Origen</th><th>Registros</th><th>Pagos</th></tr>
              </thead>
              <tbody>
                {data.por_origen.map((item) => (
                  <tr key={item.origen} className="border-t border-border/60">
                    <td className="py-2">{item.origen}</td>
                    <td>{item.registros}</td>
                    <td>{item.pagos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </AdminShell>
  );
}

function Alerta({ titulo, vacio, children }: { titulo: string; vacio: string; children: ReactNode }) {
  const lista = Array.isArray(children) ? children.filter(Boolean) : [children];
  const hay = lista.some(Boolean);
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
      <div className="space-y-1">{hay ? children : <p className="text-sm text-muted-foreground">{vacio}</p>}</div>
    </section>
  );
}
