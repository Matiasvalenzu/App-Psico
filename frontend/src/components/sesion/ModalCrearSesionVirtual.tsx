"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Mail,
  MessageCircle,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { ClientPortal } from "@/components/ui/ClientPortal";
import { apiFetch } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  paciente: any;
  onSessionCreated?: (sesion: any) => void;
}

function getDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function ModalCrearSesionVirtual({ open, onClose, paciente, onSessionCreated }: Props) {
  const router = useRouter();
  const [dateTime, setDateTime] = useState(getDateTimeInputValue());
  const [creating, setCreating] = useState(false);
  const [sesion, setSesion] = useState<any | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pacienteNombre =
    paciente.nombre_completo || `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim() || "Paciente";

  useEffect(() => {
    if (!open) {
      setDateTime(getDateTimeInputValue());
      setSesion(null);
      setEmailSent(false);
      setCopied(false);
      setError(null);
    }
  }, [open]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch("/sesiones/crear_virtual_propia/", {
        method: "POST",
        body: JSON.stringify({
          paciente: paciente.id,
          fecha_hora_inicio: new Date(dateTime).toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo crear la sala virtual.");
        return;
      }
      setSesion(data);
      onSessionCreated?.(data);
    } catch {
      setError("Error de red al crear la sala virtual.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!sesion?.url_reunion) return;
    try {
      await navigator.clipboard.writeText(sesion.url_reunion);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {}
  }

  function handleWhatsApp() {
    if (!sesion?.url_reunion) return;
    const cleanPhone = (paciente.telefono_whatsapp || "").replace(/[^\d+]/g, "");
    const fechaObj = new Date(dateTime);
    const horaStr = fechaObj.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    const fechaStr = formatDateCL(fechaObj);
    const msg = `Hola ${paciente.nombre || ""}, te comparto el enlace de la videollamada de Psiconex para nuestra sesión del ${fechaStr} a las ${horaStr} hrs:\n\n${sesion.url_reunion}\n\nNo necesitas instalar nada: ábrelo desde tu navegador (Chrome, Safari o Edge). Conéctate desde un lugar tranquilo, privado y con audífonos. ¡Nos vemos!`;
    const targetUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSendEmail() {
    if (!sesion) return;
    if (!paciente.email_contacto) {
      setError("El paciente no tiene un correo electrónico registrado en su ficha.");
      return;
    }
    setSendingEmail(true);
    setError(null);
    try {
      const res = await apiFetch(`/sesiones/${sesion.id}/enviar_enlace_paciente/`, {
        method: "POST",
        body: JSON.stringify({ email: paciente.email_contacto }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo enviar el correo al paciente.");
        return;
      }
      setEmailSent(true);
    } catch {
      setError("Error de red al enviar el correo al paciente.");
    } finally {
      setSendingEmail(false);
    }
  }

  function handleEnterRoom() {
    if (!sesion) return;
    onClose();
    router.push(`/dashboard/pacientes/${paciente.id}/sesiones/${sesion.id}/sala`);
  }

  if (!open) return null;

  return (
    <ClientPortal>
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl transition-all">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Sesión Virtual Psiconex</h3>
              <p className="text-xs text-muted-foreground">
                Paciente: <strong className="text-foreground">{pacienteNombre}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-50/60 p-3 text-xs text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Videollamada directa y cifrada entre tú y el paciente. Cada voz se graba en una pista
              separada, así la transcripción identifica a cada participante sin errores.
            </span>
          </div>

          {!sesion ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha y hora de la sesión</label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Sala creada. Comparte el enlace con el paciente.
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
                <input
                  readOnly
                  value={sesion.url_reunion}
                  className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-foreground focus:outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={sendingEmail || emailSent}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : emailSent ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {emailSent ? "Correo enviado" : "Enviar por correo"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {sesion ? "Cerrar" : "Cancelar"}
          </button>
          {!sesion ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear sala
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnterRoom}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              <Video className="h-4 w-4" />
              Entrar a la sala
            </button>
          )}
        </div>
      </div>
    </ClientPortal>
  );
}
