"use client";

import { useState } from "react";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Cobro } from "./cobros";
import { getApiErrorMessage } from "./utils";

export default function EnvioBoleta({
  cobro,
  onChanged,
  onCompletarFicha,
  compact = false,
}: {
  cobro: Cobro;
  onChanged?: (cobro: Cobro) => void;
  onCompletarFicha?: () => void;
  compact?: boolean;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const envio = cobro.envio;
  const puedePdf = Boolean(envio?.puede_pdf);
  const tieneTelefono = Boolean(envio?.tiene_telefono);
  const email = envio?.email || "";
  const ultimo = envio?.ultimo_correo;

  async function abrirWhatsapp(event: React.MouseEvent) {
    event.stopPropagation();
    setAbriendo(true);
    try {
      const res = await apiFetch(`/facturacion/cobros/${cobro.id}/enlace-whatsapp/`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(getApiErrorMessage(data, "No se pudo armar el mensaje."));
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo abrir WhatsApp.");
    } finally {
      setAbriendo(false);
    }
  }

  async function enviarCorreo() {
    setEnviando(true);
    try {
      const res = await apiFetch(`/facturacion/cobros/${cobro.id}/enviar-correo/`, {
        method: "POST",
        body: JSON.stringify({ confirmado: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(getApiErrorMessage(data, "No se pudo enviar el correo."));
        return;
      }
      toast.success("Boleta enviada por correo.");
      setConfirmar(false);
      onChanged?.(data);
    } catch {
      toast.error("No se pudo enviar el correo.");
    } finally {
      setEnviando(false);
    }
  }

  const faltaContacto = puedePdf && (!tieneTelefono || !email);

  return (
    <div className={compact ? "flex flex-wrap items-center justify-end gap-1" : "space-y-2"} onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!puedePdf || !tieneTelefono || abriendo}
          title={
            !puedePdf
              ? "Disponible cuando la boleta esté emitida y tenga PDF."
              : !tieneTelefono
                ? "Completa el teléfono en la ficha."
                : "Abrir WhatsApp con el mensaje listo. No se envía solo."
          }
          onClick={abrirWhatsapp}
        >
          {abriendo ? <Loader2 className="animate-spin" /> : <MessageCircle />}
          {compact ? <span className="sr-only">WhatsApp</span> : "WhatsApp"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!puedePdf || !email}
          title={
            !puedePdf
              ? "Disponible cuando la boleta esté emitida y tenga PDF."
              : !email
                ? "Completa el correo en la ficha."
                : "Enviar el PDF por correo. Pide confirmación."
          }
          onClick={(e) => {
            e.stopPropagation();
            setConfirmar(true);
          }}
        >
          <Mail />
          {compact ? <span className="sr-only">Correo</span> : "Correo"}
        </Button>
        {faltaContacto && (
          <button type="button" className="text-xs font-medium text-primary underline" onClick={() => onCompletarFicha?.()}>
            Completar la ficha
          </button>
        )}
      </div>
      {ultimo && !compact && (
        <p className="text-xs text-muted-foreground">Enviada por correo el {formatDateCL(ultimo.enviado_at, true)}.</p>
      )}
      {ultimo && compact && (
        <p className="w-full text-right text-[11px] text-muted-foreground">Enviada el {formatDateCL(ultimo.enviado_at, true)}</p>
      )}

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar boleta por correo</DialogTitle>
            <DialogDescription>
              Se enviará el PDF a <span className="font-medium text-foreground">{email}</span>. No se manda hasta que confirmes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmar(false)} disabled={enviando}>
              Ahora no
            </Button>
            <Button type="button" size="sm" onClick={enviarCorreo} disabled={enviando || !email}>
              {enviando && <Loader2 className="animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
