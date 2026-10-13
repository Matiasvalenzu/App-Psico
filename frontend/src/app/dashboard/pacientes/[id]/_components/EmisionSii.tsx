"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCLP, MODOS_BOLETA, receptorListoParaSii, type Cobro, type DelegacionBHE, type EstadoEmision } from "./cobros";
import { getApiErrorMessage } from "./utils";

const URL_SII = "https://www.sii.cl/servicios_online/";
// Se consulta solo mientras la emisión está en cola o en curso; EMITIDA, FALLIDA, DESCONOCIDO o CANCELADA la cierran.
const EN_SEGUIMIENTO: EstadoEmision[] = ["PENDIENTE", "EN_CURSO"];
const ESPERA_INICIAL_MS = 2000;
const ESPERA_MAXIMA_MS = 30000;

export function emitidaPorPsiconex(cobro: Cobro) {
  const emision = cobro.ultima_emision;
  return cobro.estado_boleta === "EMITIDA" && emision?.tipo === "EMISION" && emision.estado === "EMITIDA";
}

function Fila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

// Emisión automática en el SII (Fase 2): confirmación, seguimiento de la cola y anulación guiada.
export default function EmisionSii({
  cobro,
  delegacion,
  soloLectura,
  onChanged,
}: {
  cobro: Cobro;
  delegacion: DelegacionBHE | null;
  soloLectura: boolean;
  onChanged: (cobro: Cobro) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmarAnulada, setConfirmarAnulada] = useState(false);
  const [error, setError] = useState("");
  const enviadoRef = useRef(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const emision = cobro.ultima_emision?.tipo === "EMISION" ? cobro.ultima_emision : null;
  const enSeguimiento = cobro.estado_boleta === "EN_EMISION" && Boolean(emision && EN_SEGUIMIENTO.includes(emision.estado));

  useEffect(() => {
    if (!enSeguimiento) return;
    let cancelado = false;
    let espera = ESPERA_INICIAL_MS;
    let timer: ReturnType<typeof setTimeout>;
    async function consultar() {
      try {
        const res = await apiFetch(`/facturacion/cobros/${cobro.id}/`);
        if (res.ok) {
          const data: Cobro = await res.json();
          if (cancelado) return;
          onChangedRef.current(data);
          if (!data.ultima_emision || !EN_SEGUIMIENTO.includes(data.ultima_emision.estado)) return;
        }
      } catch {
        // Un fallo de red no corta el seguimiento: se reintenta con la espera siguiente.
      }
      if (cancelado) return;
      espera = Math.min(espera * 1.5, ESPERA_MAXIMA_MS);
      timer = setTimeout(consultar, espera);
    }
    timer = setTimeout(consultar, espera);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [cobro.id, enSeguimiento]);

  async function accion(path: string, init: RequestInit, exito: string) {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`/facturacion/cobros/${cobro.id}/${path}`, init);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "No se pudo completar la acción."));
        return;
      }
      toast.success(exito);
      onChanged(data);
    } catch {
      setError("No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  }

  async function emitir() {
    // El botón se desactiva al primer clic; si igual llegan dos solicitudes, el backend devuelve la misma emisión
    // (clave de idempotencia por cobro y versión), así que nunca salen dos boletas.
    if (enviadoRef.current) return;
    enviadoRef.current = true;
    setEnviando(true);
    setError("");
    try {
      const res = await apiFetch(`/facturacion/cobros/${cobro.id}/emitir-sii/`, {
        method: "POST",
        body: JSON.stringify({ confirmado: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "No se pudo enviar la boleta al SII."));
        setConfirmando(false);
        return;
      }
      toast.success("Boleta enviada al SII.");
      setConfirmando(false);
      onChanged(data);
    } catch {
      setError("No se pudo enviar la boleta al SII.");
      setConfirmando(false);
    } finally {
      enviadoRef.current = false;
      setEnviando(false);
    }
  }

  async function descargarPdf() {
    if (!emision) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/facturacion/cobros/${cobro.id}/emisiones/${emision.id}/pdf/`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `boleta-${emision.folio || cobro.boleta_folio}.pdf`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  const errorAlert = error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  // En cola, emitiendo o por confirmar.
  if (cobro.estado_boleta === "EN_EMISION") {
    return (
      <div className="space-y-3">
        {errorAlert}
        {emision?.estado === "DESCONOCIDO" ? (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertDescription>
              Estamos confirmando con el SII si la boleta quedó emitida. No la emitas a mano todavía: puede
              tardar unos 15 minutos. Vuelve a abrir la boleta más tarde para ver el folio o intentarlo de nuevo.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-4 text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {emision?.estado === "EN_CURSO" ? "Emitiendo la boleta en el SII…" : "En cola para emitir en el SII…"}
            </span>
            {!soloLectura && emision?.estado === "PENDIENTE" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => accion("cancelar-sii/", { method: "POST" }, "Emisión cancelada.")}
              >
                Cancelar
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Emitida por Psiconex: folio, PDF y anulación (la hace el psicólogo en el SII).
  if (emitidaPorPsiconex(cobro)) {
    return (
      <div className="space-y-3">
        {errorAlert}
        <Alert variant="success">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Emitida en el SII, folio N° <span className="font-semibold">{cobro.boleta_folio}</span>.
            </span>
            {emision?.tiene_pdf && (
              <Button size="sm" variant="outline" onClick={descargarPdf} disabled={busy}>
                <Download />
                Descargar PDF
              </Button>
            )}
          </AlertDescription>
        </Alert>

        {!soloLectura && !cobro.anulacion_solicitada_at && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => accion("anular-sii/", { method: "POST" }, "Te dejamos los pasos para anularla en el SII.")}
          >
            Anular en el SII
          </Button>
        )}

        {!soloLectura && cobro.anulacion_solicitada_at && (
          <div className="space-y-3 rounded-xl border border-border/70 p-4 text-sm">
            <p className="font-medium">Para anular la boleta en el SII</p>
            {cobro.plazo_anulacion_vencido ? (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>
                  Pasó el plazo para anularla directamente
                  {cobro.anulable_hasta ? ` (${formatDateCL(cobro.anulable_hasta)})` : ""}. Ahora el SII exige que el
                  receptor confirme la anulación o presentar el formulario 2117. Habla con tu contador; aquí solo queda
                  registrado cuando lo marques.
                </AlertDescription>
              </Alert>
            ) : (
              cobro.anulable_hasta && (
                <p className="text-muted-foreground">Puedes anularla directamente hasta el {formatDateCL(cobro.anulable_hasta)}.</p>
              )
            )}
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Entra a{" "}
                <a href={URL_SII} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  sii.cl <ExternalLink className="h-3 w-3" />
                </a>{" "}
                con tu RUT y clave tributaria.
              </li>
              <li>
                Ve a Servicios online › Boletas de honorarios electrónicas › Emisor › Anulación y observación › Anular
                boletas emitidas.
              </li>
              <li>
                Ingresa el N° de folio <span className="font-semibold text-foreground">{cobro.boleta_folio}</span>.
              </li>
              <li>Elige la causa, por ejemplo «Error en la digitación», y confirma.</li>
              <li>Vuelve aquí y marca «Ya la anulé».</li>
            </ol>
            <p className="text-muted-foreground">El SII avisa que el receptor tiene que estar de acuerdo con la anulación.</p>
            {confirmarAnulada ? (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription className="space-y-3">
                  <p>¿Ya la anulaste en el SII? Esto no anula nada allá; solo deja registrado que la anulaste.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmarAnulada(false)} disabled={busy}>
                      Volver
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => accion("marcar-anulada/", { method: "POST" }, "Boleta marcada como anulada.")}
                    >
                      {busy && <Loader2 className="animate-spin" />}
                      Sí, ya la anulé
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmarAnulada(true)}>
                Ya la anulé
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (soloLectura || !delegacion || (cobro.estado_boleta !== "PENDIENTE" && cobro.estado_boleta !== "ANULADA")) {
    return null;
  }

  const fallida = cobro.estado_boleta === "PENDIENTE" && emision?.estado === "FALLIDA" ? emision : null;
  const listo = receptorListoParaSii(cobro);
  const porEmisor = cobro.bhe_modo === "RETENCION_POR_EMISOR";
  const tasa = Number(cobro.tasa_retencion).toLocaleString("es-CL");

  return (
    <div className="space-y-3">
      {errorAlert}
      {fallida && (
        <Alert variant="destructive">
          <AlertDescription>
            No se pudo emitir en el SII: {fallida.error_detalle || "el SII no aceptó la boleta."} No quedó ninguna boleta
            emitida. Corrige el cobro si hace falta e inténtalo de nuevo, o emítela a mano.
          </AlertDescription>
        </Alert>
      )}

      {delegacion.motivo_bloqueo ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription>
            {delegacion.mensaje_bloqueo}{" "}
            {delegacion.motivo_bloqueo === "delegacion_inactiva" && (
              <Link href="/dashboard/configuracion/boletas" className="font-medium underline">
                Revisa la autorización
              </Link>
            )}
            {!["delegacion_inactiva", "bhe_pausada"].includes(delegacion.motivo_bloqueo) &&
              "Mientras tanto, puedes emitirla a mano."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="min-w-0 flex-1">
            {listo
              ? "Psiconex puede emitir esta boleta en el SII por ti."
              : "Para emitirla en el SII completa RUT, nombre, dirección y comuna del receptor (edita el cobro)."}
          </p>
          <Button onClick={() => setConfirmando(true)} disabled={!listo || busy}>
            <Send />
            {cobro.estado_boleta === "ANULADA" ? "Emitir de nuevo en el SII" : "Emitir en el SII"}
          </Button>
        </div>
      )}

      <Dialog open={confirmando} onOpenChange={(next) => !enviando && setConfirmando(next)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>¿Emitir la boleta en el SII?</DialogTitle>
            <DialogDescription>
              Esto emite un documento tributario real a tu nombre. Revisa los datos antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border/60 rounded-xl border border-border/70 px-4 text-sm">
            <Fila label="Receptor" value={`${cobro.receptor_nombre} (${cobro.receptor_documento})`} />
            <Fila label="Dirección" value={`${cobro.receptor_direccion}, ${cobro.receptor_comuna}`} />
            <Fila label="Glosa" value={cobro.glosa} />
            <Fila label="Fecha de la boleta" value="Hoy" />
            <Fila label="Monto bruto" value={formatCLP(cobro.monto_bruto)} />
            <Fila label={`Retención (${tasa} %)`} value={`−${formatCLP(cobro.monto_retencion)}`} />
            <Fila label="Líquido" value={formatCLP(cobro.monto_liquido)} />
            <Fila label="Retención" value={MODOS_BOLETA[cobro.bhe_modo]} />
          </div>
          {porEmisor && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription>
                La boleta del SII muestra solo el monto bruto, sin la retención ni el líquido (esos montos los calcula
                Psiconex). La retención la declaras tú en tu F29.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={enviando}>
              Volver
            </Button>
            <Button onClick={emitir} disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Sí, emitir en el SII
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
