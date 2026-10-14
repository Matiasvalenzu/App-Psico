"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, ExternalLink, Loader2, Send, Upload } from "lucide-react";
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
import EnvioBoleta from "./EnvioBoleta";

const URL_SII = "https://www.sii.cl/servicios_online/";
// Se consulta solo mientras la emisión está en cola o en curso; EMITIDA, FALLIDA, DESCONOCIDO o CANCELADA la cierran.
const EN_SEGUIMIENTO: EstadoEmision[] = ["PENDIENTE", "EN_CURSO"];
const ESPERA_INICIAL_MS = 2000;
const ESPERA_MAXIMA_MS = 30000;
// Si quedó EMITIDA sin PDF, la recuperación de respaldo puede traerlo en unos segundos: se espera como máximo esto.
const ESPERA_PDF_MS = 30000;
const INTERVALO_PDF_MS = 5000;

export function emitidaPorPsiconex(cobro: Cobro) {
  const emision = cobro.ultima_emision;
  return cobro.estado_boleta === "EMITIDA" && emision?.tipo === "EMISION" && emision.estado === "EMITIDA";
}

function Fila({ label, value, destacado = false }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className={destacado ? "flex justify-between gap-4 py-2 text-base" : "flex justify-between gap-4 py-1.5"}>
      <span className={destacado ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={destacado ? "text-right font-semibold tabular-nums" : "text-right font-medium"}>{value || "—"}</span>
    </div>
  );
}

// Emisión automática en el SII (Fase 2): confirmación, seguimiento de la cola y anulación guiada.
export default function EmisionSii({
  cobro,
  delegacion,
  soloLectura,
  onChanged,
  onEdit,
  onCompletarFicha,
}: {
  cobro: Cobro;
  delegacion: DelegacionBHE | null;
  soloLectura: boolean;
  onChanged: (cobro: Cobro) => void;
  onEdit: () => void;
  onCompletarFicha?: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmarAnulada, setConfirmarAnulada] = useState(false);
  const [error, setError] = useState("");
  const [buscandoPdf, setBuscandoPdf] = useState(false);
  const enviadoRef = useRef(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
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
          const ultima = data.ultima_emision;
          if (!ultima || !EN_SEGUIMIENTO.includes(ultima.estado)) {
            if (ultima?.estado === "EMITIDA" && !ultima.tiene_pdf) setBuscandoPdf(true);
            return;
          }
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

  useEffect(() => {
    if (!buscandoPdf) return;
    const hasta = Date.now() + ESPERA_PDF_MS;
    let timer: ReturnType<typeof setTimeout>;
    async function consultar() {
      try {
        const res = await apiFetch(`/facturacion/cobros/${cobro.id}/`);
        if (res.ok) {
          const data: Cobro = await res.json();
          onChangedRef.current(data);
          if (data.ultima_emision?.tiene_pdf) return setBuscandoPdf(false);
        }
      } catch {
        // Igual que el seguimiento: un fallo de red se reintenta hasta el plazo.
      }
      if (Date.now() >= hasta) return setBuscandoPdf(false);
      timer = setTimeout(consultar, INTERVALO_PDF_MS);
    }
    timer = setTimeout(consultar, INTERVALO_PDF_MS);
    return () => clearTimeout(timer);
  }, [cobro.id, buscandoPdf]);

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

  function subirPdf(event: React.ChangeEvent<HTMLInputElement>) {
    // El que el psicólogo bajó de su SII cuando el robot no alcanzó a bajarlo; el backend revisa que traiga el folio.
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo || !emision) return;
    const body = new FormData();
    body.append("archivo", archivo);
    accion(`emisiones/${emision.id}/pdf/`, { method: "POST", body }, "PDF guardado.");
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
            <EnvioBoleta cobro={cobro} onChanged={onChanged} onCompletarFicha={onCompletarFicha} />
          </AlertDescription>
        </Alert>

        {emision && !emision.tiene_pdf && !soloLectura && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-4 text-sm">
            <span className="text-muted-foreground">
              {buscandoPdf ? "Bajando el PDF del SII…" : "Descárgala desde tu SII: Consultas › boletas emitidas."}
            </span>
            <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={subirPdf} />
            <Button size="sm" variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={busy}>
              <Upload />
              Subir PDF
            </Button>
          </div>
        )}

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
  const faltan = [
    (cobro.receptor_tipo_doc !== "RUT" || !cobro.receptor_documento?.trim()) && "RUT",
    !cobro.receptor_nombre?.trim() && "nombre",
    !cobro.receptor_direccion?.trim() && "dirección",
    !cobro.receptor_comuna?.trim() && "comuna",
  ].filter(Boolean);
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

      {cobro.receptor_desactualizado && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Los datos del paciente cambiaron en su ficha después de crear este cobro.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => accion("actualizar-receptor/", { method: "POST" }, "Datos del receptor actualizados.")}
              disabled={busy}
            >
              Actualizar datos del receptor desde la ficha
            </Button>
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
      ) : !listo ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription>
            {cobro.bhe_modo === "SIN_DATOS_RECEPTOR"
              ? "Sin datos del receptor no se puede emitir en el SII: elige otra forma de retención."
              : `Para emitirla en el SII falta ${faltan.join(", ")} del receptor.`}{" "}
            <button type="button" onClick={onEdit} className="font-medium underline">
              Editar cobro
            </button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="min-w-0 flex-1">Psiconex puede emitir esta boleta en el SII por ti.</p>
          <Button onClick={() => setConfirmando(true)} disabled={busy}>
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
            {porEmisor ? (
              <>
                <Fila label="Monto de la boleta en el SII" value={formatCLP(cobro.monto_bruto)} destacado />
                <Fila
                  label={`Retención que declaras en tu F29 (${tasa} %)`}
                  value={`${formatCLP(cobro.monto_retencion)} (no aparece en la boleta)`}
                />
              </>
            ) : (
              <>
                <Fila label="Monto bruto" value={formatCLP(cobro.monto_bruto)} />
                <Fila label={`Retención (${tasa} %)`} value={`−${formatCLP(cobro.monto_retencion)}`} />
                <Fila label="Líquido" value={formatCLP(cobro.monto_liquido)} />
              </>
            )}
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
