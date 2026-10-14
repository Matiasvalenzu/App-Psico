"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { cn, formatDateCL } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import BorradorBoleta from "./BorradorBoleta";
import CobroDialog from "./CobroDialog";
import EnvioBoleta from "./EnvioBoleta";
import { chipBoleta, ESTADOS_PAGO, etiquetaCobros, formatCLP, hoyISO, textoSesiones, type Cobro, type DelegacionBHE } from "./cobros";
import { MarcarPagadoDialog } from "./PagoCobro";
import { AsociarSesionDialog } from "./VinculoSesionDialogs";
import { fetchAllPages } from "./utils";

// Cobros del paciente. `refreshKey` permite recargar cuando se crea un cobro desde una sesión.
export default function CobrosPaciente({
  pacienteId,
  sesiones = [],
  soloLectura,
  refreshKey = 0,
  onCobroChanged,
  onCompletarFicha,
}: {
  pacienteId: number;
  sesiones?: { id: number; numero_sesion: number | null; fecha_hora_inicio: string; origen: string }[];
  soloLectura: boolean;
  refreshKey?: number;
  onCobroChanged?: (cobro: Cobro) => void;
  onCompletarFicha?: () => void;
}) {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccionado, setSeleccionado] = useState<Cobro | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Cobro | null>(null);
  // Solo con la emisión automática disponible (flag BHE_AUTO_DISPONIBLE); si no, la ficha sigue con el flujo manual.
  const [delegacion, setDelegacion] = useState<DelegacionBHE | null>(null);
  const [filtroPago, setFiltroPago] = useState("");
  const [filtroBoleta, setFiltroBoleta] = useState("");
  const sinSesionInicial = useSearchParams().get("sin_sesion") === "1";
  const [filtroSesion, setFiltroSesion] = useState(sinSesionInicial ? "SIN" : "");
  const [marcarPagado, setMarcarPagado] = useState<number | null>(null);
  const [asociar, setAsociar] = useState<Cobro | null>(null);

  const cargar = useCallback(async () => {
    setError("");
    try {
      setCobros(await fetchAllPages<Cobro>(`/facturacion/cobros/?paciente=${pacienteId}`));
    } catch {
      setError("No se pudieron cargar los cobros.");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  useEffect(() => {
    if (soloLectura) return;
    getCurrentUser()
      .then(async (user) => {
        if (!user.bhe_auto_disponible) return;
        const res = await apiFetch("/facturacion/delegacion/");
        if (res.ok) setDelegacion(await res.json());
      })
      .catch(() => setDelegacion(null));
  }, [soloLectura]);

  function reemplazar(cobro: Cobro) {
    onCobroChanged?.(cobro);
    setCobros((prev) => {
      const existe = prev.some((c) => c.id === cobro.id);
      const next = existe ? prev.map((c) => (c.id === cobro.id ? cobro : c)) : [cobro, ...prev];
      return next.sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.id - a.id);
    });
  }

  // Totales del mes en curso: lo pagado cuenta por el día del pago; lo pendiente, por la fecha de la atención.
  const mes = hoyISO().slice(0, 7);
  const sumar = (lista: Cobro[], campo: "monto_bruto" | "monto_retencion") => lista.reduce((t, c) => t + c[campo], 0);
  const pagadoMes = sumar(cobros.filter((c) => c.estado_pago === "PAGADO" && c.pagado_el?.startsWith(mes)), "monto_bruto");
  const pendienteMes = sumar(cobros.filter((c) => c.estado_pago === "PENDIENTE" && c.fecha_pago.startsWith(mes)), "monto_bruto");
  const retencionMes = sumar(
    cobros.filter((c) => c.fecha_pago.startsWith(mes) && c.estado_boleta !== "ANULADA" && c.estado_boleta !== "NO_APLICA"),
    "monto_retencion",
  );
  const visibles = cobros.filter(
    (c) =>
      (!filtroPago || c.estado_pago === filtroPago) &&
      (!filtroSesion || !(c.sesiones_detalle?.length)) &&
      (!filtroBoleta ||
        (filtroBoleta === "SIN" ? c.estado_boleta === "PENDIENTE" || c.estado_boleta === "NO_APLICA" : c.estado_boleta === filtroBoleta)),
  );

  function abrirNuevo() {
    setEditando(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Cobros y boletas</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Registra el pago y prepara la boleta para emitirla en el SII." : `${etiquetaCobros(cobros.length)}. Registra el pago y prepara la boleta para emitirla en el SII.`}
          </p>
        </div>
        {!soloLectura && (
          <Button onClick={abrirNuevo}>
            <Plus />
            Registrar cobro
          </Button>
        )}
      </div>

      {soloLectura && (
        <Alert variant="warning">
          <AlertDescription>
            Las boletas son parte del Plan Plus. Puedes ver tus cobros, pero para registrar nuevos{" "}
            <Link href="/dashboard/suscripcion" className="font-medium underline">
              revisa tu suscripción
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}

      {!loading && cobros.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Pagado este mes", valor: pagadoMes },
              { label: "Pendiente este mes", valor: pendienteMes },
              { label: "Retención estimada del mes", valor: retencionMes },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-border/70 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-lg font-semibold tabular-nums">{formatCLP(t.valor)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <NativeSelect aria-label="Filtrar por pago" value={filtroPago} onChange={(e) => setFiltroPago(e.target.value)} className="w-44">
              <option value="">Todos los pagos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="PAGADO">Pagados</option>
            </NativeSelect>
            <NativeSelect aria-label="Filtrar por sesión" value={filtroSesion} onChange={(e) => setFiltroSesion(e.target.value)} className="w-44">
              <option value="">Todas las sesiones</option>
              <option value="SIN">Sin sesión</option>
            </NativeSelect>
            <NativeSelect aria-label="Filtrar por boleta" value={filtroBoleta} onChange={(e) => setFiltroBoleta(e.target.value)} className="w-44">
              <option value="">Todas las boletas</option>
              <option value="EMITIDA">Emitidas</option>
              <option value="EN_EMISION">En emisión</option>
              <option value="ANULADA">Anuladas</option>
              <option value="SIN">Sin boleta</option>
            </NativeSelect>
          </div>
        </>
      )}

      {loading ? null : cobros.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 py-10 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Todavía no hay cobros</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Registra un cobro aquí o desde el menú de una sesión. Psiconex calcula la retención y arma el borrador de la boleta.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Sesiones</th>
                <th className="px-4 py-2 text-right font-medium">Monto</th>
                <th className="px-4 py-2 font-medium">Pago</th>
                <th className="px-4 py-2 font-medium">Boleta</th>
                <th className="px-4 py-2 font-medium">Folio</th>
                {!soloLectura && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={soloLectura ? 6 : 7} className="px-4 py-6 text-center text-muted-foreground">
                    Ningún cobro coincide con los filtros.
                  </td>
                </tr>
              )}
              {visibles.map((cobro) => {
                const estado = chipBoleta(cobro.estado_boleta, cobro.boleta_folio);
                const pago = ESTADOS_PAGO[cobro.estado_pago];
                return (
                  <tr
                    key={cobro.id}
                    onClick={() => setSeleccionado(cobro)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSeleccionado(cobro)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">{formatDateCL(cobro.fecha_pago)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {textoSesiones(cobro) || (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Sin sesión</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCLP(cobro.monto_bruto)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", pago.className)}>{pago.label}</span>
                      {cobro.estado_pago === "PAGADO" && cobro.pagado_el && (
                        <span className="ml-2 text-xs text-muted-foreground">{formatDateCL(cobro.pagado_el)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", estado.className)}>{estado.label}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{cobro.boleta_folio || "—"}</td>
                    {!soloLectura && (
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAsociar(cobro);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          Asociar sesión
                        </Button>
                        {cobro.estado_pago === "PENDIENTE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMarcarPagado(cobro.id);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            Marcar como pagado
                          </Button>
                        )}
                        <EnvioBoleta cobro={cobro} compact onChanged={reemplazar} onCompletarFicha={onCompletarFicha} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BorradorBoleta
        cobro={seleccionado}
        delegacion={delegacion}
        soloLectura={soloLectura}
        onClose={() => setSeleccionado(null)}
        onChanged={(cobro) => {
          reemplazar(cobro);
          setSeleccionado(cobro);
        }}
        onEdit={(cobro) => {
          setSeleccionado(null);
          setEditando(cobro);
          setDialogOpen(true);
        }}
        onDeleted={(id) => {
          setCobros((prev) => prev.filter((c) => c.id !== id));
          setSeleccionado(null);
        }}
        onCompletarFicha={onCompletarFicha}
        onAsociar={soloLectura ? undefined : setAsociar}
      />

      <MarcarPagadoDialog cobroId={marcarPagado} onClose={() => setMarcarPagado(null)} onDone={reemplazar} />

      {!soloLectura && (
        <AsociarSesionDialog
          open={Boolean(asociar)}
          cobro={asociar}
          pacienteId={pacienteId}
          sesiones={sesiones}
          onOpenChange={(open) => !open && setAsociar(null)}
          onSaved={(cobro) => {
            reemplazar(cobro);
            setSeleccionado((actual) => (actual?.id === cobro.id ? cobro : actual));
          }}
        />
      )}

      {!soloLectura && (
        <CobroDialog
          open={dialogOpen}
          pacienteId={pacienteId}
          sesiones={sesiones}
          cobro={editando}
          onOpenChange={setDialogOpen}
          onSaved={(cobro) => {
            reemplazar(cobro);
            setSeleccionado(cobro);
          }}
        />
      )}
    </div>
  );
}
