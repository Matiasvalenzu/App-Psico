"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import AdminShell, { StatCard } from "@/components/admin/AdminShell";
import { formatClp, formatFechaSantiago, getAdminIngresos, type AdminIngresos } from "@/lib/admin";

export default function IngresosPage() {
  const [data, setData] = useState<AdminIngresos | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminIngresos().then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <AdminShell title="Ingresos" description="MRR vigente y cobros que ya guarda la suscripción. Sin extracto de Mercado Pago.">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="MRR" value={formatClp(data.mrr_clp)} />
            <StatCard label="Estándar" value={formatClp(data.mrr_por_plan.estandar?.mrr_clp || 0)} hint={`${data.mrr_por_plan.estandar?.cuentas || 0} cuentas`} />
            <StatCard label="Plus" value={formatClp(data.mrr_por_plan.plus?.mrr_clp || 0)} hint={`${data.mrr_por_plan.plus?.cuentas || 0} cuentas`} />
            <StatCard label="Pagos del mes" value={formatClp(data.pagos_del_mes.monto_clp)} hint={`${data.pagos_del_mes.cuentas} suscripciones activas`} />
          </div>
          <p className="text-xs text-muted-foreground">{data.pagos_del_mes.nota} {data.mrr_nota}</p>
          <section className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3">Mes</th><th>Altas aún activas</th><th>Cancelaciones</th><th>MRR vigente</th></tr>
              </thead>
              <tbody>
                {data.serie_mensual.map((item) => (
                  <tr key={item.mes} className="border-t border-border/60">
                    <td className="px-4 py-2">{item.mes}</td>
                    <td>{item.altas_aun_activas}</td>
                    <td>{item.cancelaciones}</td>
                    <td>{item.mrr_vigente_clp == null ? "—" : formatClp(item.mrr_vigente_clp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <Lista titulo="Próximos cobros (7 días)" vacio="Sin cobros en 7 días.">
            {data.proximos_cobros.map((item) => (
              <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                {item.email} · {item.plan} · {formatClp(item.monto_clp)} · {formatFechaSantiago(item.proximo_cobro)}
              </Link>
            ))}
          </Lista>
          <Lista titulo="Fallidos" vacio="Sin pagos fallidos.">
            {data.fallidos.map((item) => (
              <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                {item.email} · {item.plan} · {formatFechaSantiago(item.inactiva_desde)}
              </Link>
            ))}
          </Lista>
          <Lista titulo="Cancelaciones del mes" vacio="Sin cancelaciones este mes.">
            {data.cancelaciones.map((item) => (
              <Link key={item.id} href={`/dashboard/admin/usuarios/${item.id}`} className="block text-sm hover:underline">
                {item.email} · {item.plan} · {formatFechaSantiago(item.cancelada_en)}
              </Link>
            ))}
          </Lista>
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Pagos por origen</h2>
            {data.por_origen.map((item) => (
              <p key={item.origen} className="text-sm">{item.origen}: {item.pagos} · {formatClp(item.mrr_clp)}</p>
            ))}
          </section>
        </>
      )}
    </AdminShell>
  );
}

function Lista({ titulo, vacio, children }: { titulo: string; vacio: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
      <div className="space-y-1">{items.length ? children : <p className="text-sm text-muted-foreground">{vacio}</p>}</div>
    </section>
  );
}
