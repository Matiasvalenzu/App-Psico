"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, History, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { apiFetch, clearTokens, getCurrentUser } from "@/lib/api";

type Registro = {
  id: number;
  fecha: string;
  accion: string;
  accion_display: string;
  paciente: string | null;
  objeto: string;
  ip: string | null;
};

function getError(data: Record<string, unknown>, fallback: string) {
  const value = Object.values(data)[0];
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === "string") return value;
  return fallback;
}

async function descargar(path: string, nombre: string) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error("No se pudo generar la exportación.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PrivacidadPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [tienePassword, setTienePassword] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/cuenta/actividad/").then((r) => (r.ok ? r.json() : [])), getCurrentUser()])
      .then(([actividad, user]) => {
        setRegistros(actividad);
        setTienePassword(user.tiene_password !== false);
      })
      .catch(() => setError("No pudimos cargar tu actividad."))
      .finally(() => setLoading(false));
  }, []);

  async function exportar() {
    setExportando(true);
    setError("");
    try {
      await descargar("/cuenta/exportar/", `psiconex-exportacion-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo generar la exportación.");
    } finally {
      setExportando(false);
    }
  }

  async function eliminar() {
    setEliminando(true);
    setError("");
    try {
      const res = await apiFetch("/cuenta/eliminar/", {
        method: "POST",
        body: JSON.stringify(tienePassword ? { password: confirmacion } : { confirmacion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getError(data, "No se pudo eliminar la cuenta."));
      clearTokens();
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar la cuenta.");
      setEliminando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacidad y datos</h1>
          <p className="text-sm text-muted-foreground">Tus datos clínicos son tuyos: descárgalos, revisa quién accedió y elimínalos cuando quieras.</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-3 flex items-center gap-2"><Download className="h-5 w-5 text-primary" /><h2 className="font-semibold">Exportar mis datos</h2></div>
        <p className="text-sm text-muted-foreground">
          Descarga un archivo ZIP con todos tus pacientes: fichas, consentimientos, transcripciones, tests, conversaciones e informes de IA, y tu agenda. Incluye los datos en JSON y cada sesión e informe en PDF.
        </p>
        <button type="button" onClick={exportar} disabled={exportando} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50">
          {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exportando ? "Preparando archivo…" : "Descargar todo (ZIP)"}
        </button>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-3 flex items-center gap-2"><History className="h-5 w-5 text-primary" /><h2 className="font-semibold">Actividad reciente</h2></div>
        <p className="mb-4 text-sm text-muted-foreground">Registro de accesos a datos clínicos desde tu cuenta. Se conserva durante 12 meses.</p>
        {loading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : registros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay actividad registrada.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Paciente</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{new Date(r.fecha).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-3 py-2">
                      {r.accion_display}
                      {r.objeto && <span className="block text-xs text-muted-foreground">{r.objeto}</span>}
                      {r.paciente && <span className="block text-xs text-muted-foreground sm:hidden">{r.paciente}</span>}
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">{r.paciente ?? "—"}</td>
                    <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground md:table-cell">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-card p-5 shadow-sm md:p-6">
        <div className="mb-3 flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /><h2 className="font-semibold">Eliminar mi cuenta</h2></div>
        <p className="text-sm text-muted-foreground">
          Se eliminan de forma permanente tu cuenta, todos tus pacientes, sesiones, transcripciones, tests, informes y tu agenda. También se cancela tu suscripción y se desconecta Google Calendar. Esta acción no se puede deshacer: descarga tus datos antes.
        </p>
        {!confirmando ? (
          <button type="button" onClick={() => setConfirmando(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5">
            <Trash2 className="h-4 w-4" />
            Eliminar cuenta y datos
          </button>
        ) : (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4" />{tienePassword ? "Ingresa tu contraseña para confirmar." : "Escribe ELIMINAR para confirmar."}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type={tienePassword ? "password" : "text"}
                value={confirmacion}
                onChange={(event) => setConfirmacion(event.target.value)}
                placeholder={tienePassword ? "Contraseña" : "ELIMINAR"}
                autoComplete={tienePassword ? "current-password" : "off"}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
              <button type="button" onClick={eliminar} disabled={eliminando || !confirmacion} className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
                {eliminando && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar definitivamente
              </button>
              <button type="button" onClick={() => { setConfirmando(false); setConfirmacion(""); }} className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
