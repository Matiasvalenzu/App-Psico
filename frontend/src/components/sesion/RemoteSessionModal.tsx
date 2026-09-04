"use client";

import React, { useState, useEffect } from "react";
import {
  Video,
  Sparkles,
  Calendar,
  Mail,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  Link as LinkIcon,
  CheckCircle2,
} from "lucide-react";
import { ClientPortal } from "@/components/ui/ClientPortal";
import { apiFetch } from "@/lib/api";

function getApiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const entries = Object.values(data as Record<string, unknown>);
  const first = entries[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  if (typeof first === "string") return first;
  return fallback;
}

interface PacienteData {
  id: number;
  nombre?: string;
  apellido?: string;
  nombre_completo?: string;
  email_contacto?: string;
  telefono_whatsapp?: string;
}

interface RemoteSessionModalProps {
  open: boolean;
  onClose: () => void;
  paciente: PacienteData;
  onSessionCreated?: (sesion: any) => void;
  onStartAssistant?: (sesion: any, meetUrl: string) => void;
}

function getDateTimeInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function RemoteSessionModal({
  open,
  onClose,
  paciente,
  onSessionCreated,
  onStartAssistant,
}: RemoteSessionModalProps) {
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [meetUrl, setMeetUrl] = useState("");
  const [dateTime, setDateTime] = useState(getDateTimeInputValue());
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [createdSession, setCreatedSession] = useState<any | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pacienteNombre =
    paciente.nombre_completo ||
    `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim() ||
    "Paciente";

  useEffect(() => {
    if (!open) {
      setMeetUrl("");
      setDateTime(getDateTimeInputValue());
      setCreatedSession(null);
      setEmailSent(false);
      setCopied(false);
      setError(null);
      return;
    }

    // Comprobar estado de Google Calendar
    async function checkGoogleStatus() {
      setCheckingGoogle(true);
      try {
        const res = await apiFetch("/sesiones/google_meet_status/");
        if (res.ok) {
          const data = await res.json();
          setGoogleConnected(Boolean(data.connected));
        } else {
          setGoogleConnected(false);
        }
      } catch {
        setGoogleConnected(false);
      } finally {
        setCheckingGoogle(false);
      }
    }
    checkGoogleStatus();
  }, [open]);

  // Iniciar flujo OAuth de Google Calendar con autenticación de sesión
  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    setError(null);
    try {
      const res = await apiFetch("/agenda/google/connect/");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || data?.error || "No se pudo iniciar la conexión con Google Calendar.");
        return;
      }
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        setError("No se recibió la URL de autorización de Google.");
      }
    } catch {
      setError("Error de red al conectar con Google.");
    } finally {
      setConnectingGoogle(false);
    }
  }

  // Generar enlace automático con Google Calendar API
  async function handleGenerateMeet() {
    setError(null);
    setGeneratingMeet(true);
    try {
      const res = await apiFetch("/sesiones/generar_meet/", {
        method: "POST",
        body: JSON.stringify({
          paciente: paciente.id,
          fecha_hora_inicio: new Date(dateTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo generar el enlace de Google Meet.");
        return;
      }
      if (data.meet_url) {
        setMeetUrl(data.meet_url);
      }
    } catch {
      setError("Error de conexión al generar el enlace de Google Meet.");
    } finally {
      setGeneratingMeet(false);
    }
  }

  // Crear la sesión en Psiconex
  async function ensureSessionCreated(): Promise<any | null> {
    if (createdSession) return createdSession;
    if (!meetUrl.trim()) {
      setError("Ingresa o genera un enlace de Google Meet antes de continuar.");
      return null;
    }

    setCreatingSession(true);
    setError(null);
    try {
      const res = await apiFetch("/sesiones/crear_virtual/", {
        method: "POST",
        body: JSON.stringify({
          paciente: paciente.id,
          plataforma: "GOOGLE_MEET",
          url_reunion: meetUrl.trim(),
          fecha_hora_inicio: new Date(dateTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(getApiErrorMessage(data, "No se pudo registrar la sesión remota."));
        return null;
      }
      setCreatedSession(data);
      if (onSessionCreated) onSessionCreated(data);
      return data;
    } catch {
      setError("Error de red al registrar la sesión remota.");
      return null;
    } finally {
      setCreatingSession(false);
    }
  }

  // Enviar por correo al paciente
  async function handleSendEmail() {
    setError(null);
    const sesion = await ensureSessionCreated();
    if (!sesion) return;

    if (!paciente.email_contacto) {
      setError("El paciente no tiene un correo electrónico registrado en su ficha.");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await apiFetch(`/sesiones/${sesion.id}/enviar_enlace_paciente/`, {
        method: "POST",
        body: JSON.stringify({ email: paciente.email_contacto }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo enviar el correo al paciente.");
        return;
      }
      setEmailSent(true);
    } catch {
      setError("Error de red al enviar el correo al paciente.");
    } finally {
      setSendingEmail(false);
    }
  }

  // Copiar al portapapeles
  async function handleCopyLink() {
    if (!meetUrl) return;
    try {
      await navigator.clipboard.writeText(meetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {}
  }

  // Enviar por WhatsApp
  function handleWhatsApp() {
    if (!meetUrl) return;
    const cleanPhone = (paciente.telefono_whatsapp || "").replace(/[^\d+]/g, "");
    const fechaObj = new Date(dateTime);
    const horaStr = fechaObj.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    const fechaStr = fechaObj.toLocaleDateString("es-CL", { day: "numeric", month: "long" });

    const msg = `Hola ${paciente.nombre || ""}, te comparto el enlace de Google Meet para nuestra sesión psicológica del ${fechaStr} a las ${horaStr} hrs:\n\n${meetUrl}\n\nRecomendaciones: Conéctate desde un lugar tranquilo, privado y con audífonos. ¡Nos vemos!`;
    const targetUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  // Iniciar sesión y pasar al asistente de audio
  async function handleLaunchMeetAndRecord() {
    const sesion = await ensureSessionCreated();
    if (!sesion) return;

    onClose();
    if (onStartAssistant) {
      onStartAssistant(sesion, meetUrl);
    }
  }

  if (!open) return null;

  return (
    <ClientPortal>
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Nueva Sesión Remota (Google Meet)
              </h3>
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

        {/* Content */}
        <div className="py-5 space-y-4">
          {/* Card Google Calendar */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-sky-500" />
                Cuenta Google para Meet
              </span>
              {checkingGoogle ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
                </span>
              ) : googleConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Check className="h-3 w-3" /> Conectado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connectingGoogle}
                  className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {connectingGoogle && <Loader2 className="h-3 w-3 animate-spin" />}
                  Conectar Google Calendar &rarr;
                </button>
              )}
            </div>

            {googleConnected ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Puedes generar la reunión directamente en tu cuenta de Google en 1 clic.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateMeet}
                  disabled={generatingMeet}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600/10 border border-sky-500/30 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-600/20 dark:bg-sky-500/20 dark:text-sky-300 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {generatingMeet ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                  )}
                  {meetUrl ? "Regenerar Meet" : "Generar enlace Meet"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vincula tu Google Calendar en la sección Agenda para generar enlaces de Meet automáticamente, o pega un enlace manual abajo.
              </p>
            )}
          </div>

          {/* Formulario Enlace y Fecha */}
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Enlace de la videollamada Google Meet
              </span>
              <div className="relative">
                <input
                  type="url"
                  value={meetUrl}
                  onChange={(e) => setMeetUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {meetUrl && (
                  <a
                    href={meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground hover:text-foreground"
                    title="Probar enlace"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Fecha y hora de la sesión
              </span>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
          </div>

          {/* Acciones de entrega al paciente */}
          {meetUrl && (
            <div className="rounded-xl border border-border/70 bg-muted/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Enviar enlace al paciente
                </span>
                {emailSent && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Correo enviado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Enviar por correo */}
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                  title={paciente.email_contacto ? `Enviar a ${paciente.email_contacto}` : "Sin correo registrado"}
                >
                  {sendingEmail ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 text-sky-500" />
                  )}
                  {emailSent ? "Reenviar email" : "Por correo"}
                </button>

                {/* Enviar por WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs font-medium hover:bg-accent transition-colors cursor-pointer"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                  WhatsApp
                </button>

                {/* Copiar enlace */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs font-medium hover:bg-accent transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>

              {paciente.email_contacto && (
                <p className="text-[11px] text-muted-foreground">
                  Correo del paciente: <span className="font-mono text-foreground">{paciente.email_contacto}</span>
                </p>
              )}
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleLaunchMeetAndRecord}
            disabled={creatingSession || !meetUrl.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            {creatingSession && <Loader2 className="h-4 w-4 animate-spin" />}
            {creatingSession ? "Creando..." : "Unirse a Meet y Grabar"}
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    </ClientPortal>
  );
}
