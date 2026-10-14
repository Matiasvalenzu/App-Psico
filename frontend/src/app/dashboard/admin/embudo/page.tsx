"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminEmbudo, type AdminEmbudo } from "@/lib/admin";

export default function EmbudoPage() {
  const [data, setData] = useState<AdminEmbudo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminEmbudo().then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <AdminShell title="Embudo" description="Cohorte semanal: de cada registro, cuántos llegaron a paciente, sesión y pago.">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <>
          <section className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Semana</th>
                  <th>Registro</th>
                  <th>Paciente</th>
                  <th>Sesión</th>
                  <th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {data.cohortes.map((item) => (
                  <tr key={item.semana} className="border-t border-border/60">
                    <td className="px-4 py-2">{item.semana}</td>
                    <td>{item.registros}</td>
                    <td>{item.primer_paciente} <span className="text-muted-foreground">({item.pct_paciente}%)</span></td>
                    <td>{item.primera_sesion} <span className="text-muted-foreground">({item.pct_sesion}%)</span></td>
                    <td>{item.pago} <span className="text-muted-foreground">({item.pct_pago}%)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Registros y pagos por origen</h2>
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
