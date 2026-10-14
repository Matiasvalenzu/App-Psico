"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { formatUsd, getAdminUso, type AdminUso } from "@/lib/admin";

export default function UsoPage() {
  const [data, setData] = useState<AdminUso | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminUso().then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <AdminShell title="Uso e IA" description="Costo agregado por servicio y mes. Sin textos clínicos.">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <>
          <section className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3">Mes</th><th>Servicio</th><th>Tokens</th><th>Costo</th></tr>
              </thead>
              <tbody>
                {data.por_servicio_mes.map((item) => (
                  <tr key={`${item.mes}-${item.servicio}`} className="border-t border-border/60">
                    <td className="px-4 py-2">{item.mes}</td>
                    <td>{item.servicio}</td>
                    <td>{item.tokens.toLocaleString("es-CL")}</td>
                    <td>{formatUsd(item.costo_usd)}</td>
                  </tr>
                ))}
                {data.por_servicio_mes.length === 0 && (
                  <tr><td className="px-4 py-6 text-muted-foreground" colSpan={4}>Sin consumo en 6 meses.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Top 10 por costo</h2>
            <ol className="space-y-1 text-sm">
              {data.top_usuarios.map((item, index) => (
                <li key={item.id}>
                  <Link href={`/dashboard/admin/usuarios/${item.id}`} className="hover:underline">
                    {index + 1}. {item.nombre || item.email} · {formatUsd(item.costo_usd)} · {item.tokens.toLocaleString("es-CL")} tokens
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </AdminShell>
  );
}
