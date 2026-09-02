"use client";

import { useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { publicApiFetch } from "@/lib/api";

type DocumentType = "RUT" | "PASAPORTE" | "OTRO";

interface Slot {
  inicio: string;
  fin: string;
}

interface ManagedReservation {
  codigo_reserva: string;
  paciente_nombre: string;
  profesional_nombre: string;
  inicio: string;
  fin: string;
  duracion_minutos: number;
  estado: string;
  version: number;
  puede_modificar: boolean;
  cambios_hasta: string;
  instrucciones: string;
}

function errorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const value = (data as Record<string, unknown>).error ?? (data as Record<string, unknown>).detail;
  if (typeof value === "string") return value;
  const first = Object.values(data as Record<string, unknown>)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  if (typeof first === "string") return first;
  return fallback;
}

function localDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

function requestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function ManageReservation({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [bookingCode, setBookingCode] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("RUT");
  const [documentNumber, setDocumentNumber] = useState("");
  const [token, setToken] = useState("");
  const [reservation, setReservation] = useState<ManagedReservation | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [mode, setMode] = useState<"detail" | "reschedule" | "cancel">("detail");
  const [operationId, setOperationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function identify() {
    if (!bookingCode.trim() || !documentNumber.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await publicApiFetch(`/agenda/publica/${slug}/gestion/identificar/`, {
        method: "POST",
        body: JSON.stringify({
          codigo_reserva: bookingCode,
          tipo_documento: documentType,
          numero_documento: documentNumber,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(data, "No pudimos identificar la reserva."));
      setToken(data.token);
      setReservation(data.reserva);
      setMode("detail");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos identificar la reserva.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSlots(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    if (!date) return;
    setBusy(true);
    setError("");
    try {
      const response = await publicApiFetch(`/agenda/publica/${slug}/gestion/slots/`, {
        method: "POST",
        body: JSON.stringify({ token, desde: date, hasta: date }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(data, "No pudimos cargar los horarios."));
      setSlots(data.slots || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos cargar los horarios.");
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!reservation || !selectedSlot) return;
    setBusy(true);
    setError("");
    try {
      const response = await publicApiFetch(`/agenda/publica/${slug}/gestion/reprogramar/`, {
        method: "POST",
        body: JSON.stringify({
          token,
          inicio: selectedSlot.inicio,
          version: reservation.version,
          request_id: operationId || requestId(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(data, "No pudimos reagendar la reserva."));
      setReservation(data.reserva);
      setMode("detail");
      setSuccess("La reserva fue reagendada. Enviamos la confirmación por correo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos reagendar la reserva.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!reservation) return;
    setBusy(true);
    setError("");
    try {
      const response = await publicApiFetch(`/agenda/publica/${slug}/gestion/cancelar/`, {
        method: "POST",
        body: JSON.stringify({
          token,
          version: reservation.version,
          request_id: operationId || requestId(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(data, "No pudimos cancelar la reserva."));
      setReservation(data.reserva);
      setMode("detail");
      setSuccess("La reserva fue cancelada. Enviamos la confirmación por correo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos cancelar la reserva.");
    } finally {
      setBusy(false);
    }
  }

  if (!reservation) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h2 className="text-lg font-bold">Gestiona tu reserva</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ingresa el código recibido por correo y tu documento.</p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Código de reserva</label>
            <input value={bookingCode} onChange={(event) => setBookingCode(event.target.value.toUpperCase())} placeholder="PSX-XXXX-XXXX-XXXX-XXXX" className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Documento</label>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm">
                <option value="RUT">RUT</option><option value="PASAPORTE">Pasaporte</option><option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Número</label>
              <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
          </div>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button onClick={identify} disabled={busy || !bookingCode.trim() || !documentNumber.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Consultar reserva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => { setReservation(null); setToken(""); setSuccess(""); }} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Otra reserva
      </button>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{reservation.codigo_reserva}</p><h2 className="mt-1 text-lg font-bold">Reserva con {reservation.profesional_nombre}</h2></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reservation.estado === "ANULADA" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{reservation.estado === "ANULADA" ? "Cancelada" : "Confirmada"}</span>
      </div>
      <div className="mt-5 rounded-xl border bg-muted/30 p-4">
        <div className="flex gap-3"><Calendar className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-semibold capitalize">{localDate(reservation.inicio)}</p><p className="mt-0.5 text-sm text-muted-foreground">{localTime(reservation.inicio)} a {localTime(reservation.fin)} hrs · {reservation.duracion_minutos} minutos</p></div></div>
      </div>
      {success && <p className="mt-4 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {mode === "reschedule" && (
        <div className="mt-5 space-y-4 border-t pt-5">
          <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nueva fecha</label><input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => loadSlots(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm" /></div>
          {busy ? <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : slots.length > 0 ? <div className="grid grid-cols-3 gap-2">{slots.map((slot) => <button key={slot.inicio} onClick={() => setSelectedSlot(slot)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedSlot?.inicio === slot.inicio ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40"}`}>{localTime(slot.inicio)}</button>)}</div> : selectedDate && <p className="text-center text-sm text-muted-foreground">No hay horarios disponibles ese día.</p>}
          <div className="flex gap-2"><button onClick={() => setMode("detail")} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium">Volver</button><button onClick={reschedule} disabled={busy || !selectedSlot} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Confirmar cambio</button></div>
        </div>
      )}

      {mode === "cancel" && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3"><XCircle className="h-5 w-5 shrink-0 text-red-600" /><div><p className="text-sm font-semibold text-red-900">¿Cancelar esta reserva?</p><p className="mt-1 text-xs leading-relaxed text-red-700">El horario quedará liberado y ambas partes recibirán una confirmación.</p></div></div>
          <div className="mt-4 flex gap-2"><button onClick={() => setMode("detail")} className="flex-1 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium">Volver</button><button onClick={cancel} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Sí, cancelar</button></div>
        </div>
      )}

      {mode === "detail" && reservation.estado !== "ANULADA" && (
        reservation.puede_modificar ? <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => { setMode("reschedule"); setOperationId(requestId()); setError(""); setSuccess(""); }} className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:border-primary/50 hover:text-primary"><RotateCcw className="h-4 w-4" /> Reagendar</button><button onClick={() => { setMode("cancel"); setOperationId(requestId()); setError(""); setSuccess(""); }} className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4" /> Cancelar</button></div> : <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">El plazo de autogestión finalizó el {localDate(reservation.cambios_hasta)} a las {localTime(reservation.cambios_hasta)} hrs.</p>
      )}
    </div>
  );
}
