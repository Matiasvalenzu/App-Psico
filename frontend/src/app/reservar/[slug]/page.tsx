"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface DisponibilidadBloque {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

interface PerfilPublico {
  slug: string;
  nombre_publico: string;
  subtitulo_publico: string;
  descripcion_publica: string;
  duracion_minutos: number;
  acepta_pacientes_nuevos: boolean;
  disponibilidad: DisponibilidadBloque[];
}

interface Slot {
  inicio: string;
  fin: string;
}

interface ReservaResult {
  reserva: {
    id: number;
    fecha: string;
    hora: string;
    duracion_minutos: number;
    estado: string;
    paciente_nombre: string;
  };
  mensaje: string;
}

type Step = "tipo" | "identificacion" | "calendario" | "resumen" | "confirmado";

/* ─── Helpers ────────────────────────────────────────────────────── */

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_SEMANA_COMPLETO = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatDate(d: Date) {
  return `${DIAS_SEMANA_COMPLETO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function formatHora(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function dateKey(d: Date) {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function ReservarPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Global state
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Step navigation
  const [step, setStep] = useState<Step>("tipo");

  // Step 1: Type selection
  const [tipoPaciente, setTipoPaciente] = useState<"EXISTENTE" | "NUEVO" | null>(null);

  // Step 2a: Existing patient verification
  const [verificarField, setVerificarField] = useState<"rut" | "email" | "whatsapp">("email");
  const [verificarValue, setVerificarValue] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [pacienteId, setPacienteId] = useState<number | null>(null);
  const [pacienteNombre, setPacienteNombre] = useState("");
  const [verificarMsg, setVerificarMsg] = useState("");

  // Step 2b: New patient form
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [motivoConsulta, setMotivoConsulta] = useState("");

  // Step 3: Calendar
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 4: Selected slot
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Step 5: Booking
  const [reservando, setReservando] = useState(false);
  const [reservaResult, setReservaResult] = useState<ReservaResult | null>(null);

  /* ─── Load profile ─────────────────────────────────────────────── */

  useEffect(() => {
    loadPerfil();
  }, [slug]);

  async function loadPerfil() {
    try {
      const res = await publicApiFetch(`/agenda/publica/${slug}/`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se encontró esta agenda.");
        return;
      }
      setPerfil(await res.json());
    } catch {
      setError("No se pudo cargar la información. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  }

  /* ─── Load slots when date changes ─────────────────────────────── */

  useEffect(() => {
    if (selectedDate) {
      loadSlots(selectedDate);
    }
  }, [selectedDate]);

  async function loadSlots(date: Date) {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const desde = dateKey(date);
      const hasta = desde;
      const res = await publicApiFetch(`/agenda/publica/${slug}/slots/?desde=${desde}&hasta=${hasta}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingSlots(false);
    }
  }

  /* ─── Week calendar logic ──────────────────────────────────────── */

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekStart = useMemo(() => {
    const d = new Date(today);
    const dayOfWeek = d.getDay();
    // Monday-based: if Sunday (0), go back 6 days
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset + weekOffset * 7);
    return d;
  }, [today, weekOffset]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  // Which days have configured availability?
  const availableDaysOfWeek = useMemo(() => {
    if (!perfil) return new Set<number>();
    return new Set(perfil.disponibilidad.map((d) => d.dia_semana));
  }, [perfil]);

  function isDayAvailable(d: Date) {
    if (d < today) return false;
    // Python weekday: Mon=0..Sun=6. JS getDay: Sun=0..Sat=6
    const pyWeekday = d.getDay() === 0 ? 6 : d.getDay() - 1;
    return availableDaysOfWeek.has(pyWeekday);
  }

  /* ─── Verify existing patient ──────────────────────────────────── */

  async function handleVerificar() {
    if (!verificarValue.trim()) return;
    setVerificando(true);
    setVerificarMsg("");
    setPacienteId(null);
    try {
      const body: Record<string, string> = {};
      body[verificarField] = verificarValue.trim();
      const res = await publicApiFetch(`/agenda/publica/${slug}/verificar-paciente/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.encontrado) {
        setPacienteId(data.paciente_id);
        setPacienteNombre(data.nombre || "");
        setVerificarMsg("");
      } else {
        setVerificarMsg(
          data.mensaje || "No encontramos una ficha con esos datos. Puedes continuar como primera reserva."
        );
      }
    } catch {
      setVerificarMsg("Error al verificar. Intenta nuevamente.");
    } finally {
      setVerificando(false);
    }
  }

  /* ─── Submit reservation ───────────────────────────────────────── */

  async function handleReservar() {
    if (!selectedSlot || reservando) return;
    setReservando(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        tipo_paciente: tipoPaciente,
        inicio: selectedSlot.inicio,
      };
      if (tipoPaciente === "EXISTENTE") {
        body.paciente_id = pacienteId;
      } else {
        body.nombre_completo = nombreCompleto;
        body.rut = rut;
        body.email = email;
        body.whatsapp = whatsapp;
        body.motivo_consulta = motivoConsulta;
      }
      const res = await publicApiFetch(`/agenda/publica/${slug}/reservar/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo completar la reserva.");
        return;
      }
      setReservaResult(data);
      setStep("confirmado");
    } catch {
      setError("No se pudo completar la reserva. Intenta nuevamente.");
    } finally {
      setReservando(false);
    }
  }

  /* ─── Navigation helpers ───────────────────────────────────────── */

  function canProceedToCalendar() {
    if (tipoPaciente === "EXISTENTE") return !!pacienteId;
    if (tipoPaciente === "NUEVO") {
      return nombreCompleto.trim() && (email.trim() || whatsapp.trim());
    }
    return false;
  }

  function goToCalendar() {
    if (canProceedToCalendar()) {
      setStep("calendario");
    }
  }

  function goBack() {
    if (step === "identificacion") {
      setStep("tipo");
      setPacienteId(null);
      setVerificarMsg("");
    } else if (step === "calendario") {
      setStep("identificacion");
      setSelectedDate(null);
      setSelectedSlot(null);
    } else if (step === "resumen") {
      setStep("calendario");
      setSelectedSlot(null);
    }
  }

  /* ─── Renders ──────────────────────────────────────────────────── */

  // Loading state
  if (loading) {
    return (
      <main className="booking-page">
        <div className="booking-container">
          <div className="booking-card animate-fade-in-up">
            <div className="flex items-center justify-center gap-3 py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Cargando agenda...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error / Not found
  if (error && !perfil) {
    return (
      <main className="booking-page">
        <div className="booking-container">
          <div className="booking-card animate-fade-in-up text-center py-16">
            <XCircle className="mx-auto h-12 w-12 text-[hsl(var(--destructive))]" />
            <h1 className="mt-4 text-xl font-bold">Agenda no disponible</h1>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!perfil) return null;

  return (
    <main className="booking-page">
      <div className="booking-container">
        {/* Header */}
        <div className="booking-header animate-fade-in-up">
          <div className="booking-avatar">
            {perfil.nombre_publico
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{perfil.nombre_publico}</h1>
            {perfil.subtitulo_publico && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{perfil.subtitulo_publico}</p>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="booking-card animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
          {/* ── Step: Tipo ──────────────────────────────────────── */}
          {step === "tipo" && (
            <div className="booking-step">
              <h2 className="booking-title">Reserva tu próxima sesión</h2>
              <p className="booking-subtitle">
                Elige un horario disponible con {perfil.nombre_publico}. Tu reserva quedará
                registrada directamente en su agenda.
              </p>
              {perfil.descripcion_publica && (
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {perfil.descripcion_publica}
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setTipoPaciente("EXISTENTE");
                    setStep("identificacion");
                  }}
                  className="booking-type-card group"
                >
                  <div className="booking-type-icon">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="font-medium">Ya soy paciente</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Tengo ficha con este profesional
                  </span>
                </button>

                {perfil.acepta_pacientes_nuevos && (
                  <button
                    onClick={() => {
                      setTipoPaciente("NUEVO");
                      setStep("identificacion");
                    }}
                    className="booking-type-card group"
                  >
                    <div className="booking-type-icon">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <span className="font-medium">Primera vez</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      Quiero agendar mi primera sesión
                    </span>
                  </button>
                )}
              </div>

              <div className="mt-6 flex items-center gap-2 rounded-lg bg-[hsl(var(--muted)/0.5)] px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                Sesión de {perfil.duracion_minutos} minutos
              </div>
            </div>
          )}

          {/* ── Step: Identificación (Existente) ───────────────── */}
          {step === "identificacion" && tipoPaciente === "EXISTENTE" && (
            <div className="booking-step">
              <button onClick={goBack} className="booking-back">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              <h2 className="booking-title">Identifica tu ficha</h2>
              <p className="booking-subtitle">
                Ingresa tu email, WhatsApp o RUT para encontrar tu ficha de paciente.
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex gap-2">
                  {(["email", "whatsapp", "rut"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setVerificarField(f);
                        setVerificarValue("");
                        setPacienteId(null);
                        setVerificarMsg("");
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        verificarField === f
                          ? "bg-[hsl(var(--primary))] text-white"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                      }`}
                    >
                      {f === "email" ? "Email" : f === "whatsapp" ? "WhatsApp" : "RUT"}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type={verificarField === "email" ? "email" : "text"}
                    value={verificarValue}
                    onChange={(e) => setVerificarValue(e.target.value)}
                    placeholder={
                      verificarField === "email"
                        ? "tu@email.com"
                        : verificarField === "whatsapp"
                          ? "+56 9 1234 5678"
                          : "12.345.678-9"
                    }
                    className="booking-input flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleVerificar()}
                  />
                  <button
                    onClick={handleVerificar}
                    disabled={verificando || !verificarValue.trim()}
                    className="booking-btn-primary whitespace-nowrap"
                  >
                    {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </button>
                </div>

                {pacienteId && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                      ¡Hola, {pacienteNombre}! Encontramos tu ficha.
                    </p>
                    <button onClick={goToCalendar} className="booking-btn-primary mt-3 w-full">
                      Elegir horario
                    </button>
                  </div>
                )}

                {verificarMsg && !pacienteId && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm text-amber-800 dark:text-amber-300">{verificarMsg}</p>
                    <button
                      onClick={() => {
                        setTipoPaciente("NUEVO");
                        // Don't go back to "tipo", just switch context
                      }}
                      className="mt-2 text-xs font-medium text-amber-700 underline hover:no-underline dark:text-amber-400"
                    >
                      Continuar como primera reserva →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Identificación (Nuevo) ───────────────────── */}
          {step === "identificacion" && tipoPaciente === "NUEVO" && (
            <div className="booking-step">
              <button onClick={goBack} className="booking-back">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              <h2 className="booking-title">Primera vez con este profesional</h2>
              <p className="booking-subtitle">
                Déjanos tus datos básicos para crear tu ficha y reservar tu primera sesión.
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="booking-label">Nombre completo *</label>
                  <input
                    type="text"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    placeholder="Ej: María González Pérez"
                    className="booking-input"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="booking-label">RUT</label>
                    <input
                      type="text"
                      value={rut}
                      onChange={(e) => setRut(e.target.value)}
                      placeholder="12.345.678-9"
                      className="booking-input"
                    />
                  </div>
                  <div>
                    <label className="booking-label">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="booking-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="booking-label">WhatsApp</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="booking-input"
                  />
                </div>
                <div>
                  <label className="booking-label">Motivo de consulta</label>
                  <textarea
                    value={motivoConsulta}
                    onChange={(e) => setMotivoConsulta(e.target.value)}
                    placeholder="Cuéntanos brevemente por qué buscas atención (opcional)"
                    rows={3}
                    className="booking-input resize-none"
                  />
                </div>

                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Ingresa al menos email o WhatsApp como dato de contacto.
                </p>

                <button
                  onClick={goToCalendar}
                  disabled={!canProceedToCalendar()}
                  className="booking-btn-primary w-full"
                >
                  Elegir horario
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Calendario ───────────────────────────────── */}
          {step === "calendario" && (
            <div className="booking-step">
              <button onClick={goBack} className="booking-back">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              <h2 className="booking-title">Elige día y hora</h2>
              <p className="booking-subtitle">
                Selecciona un día disponible y luego elige tu horario preferido.
              </p>

              {/* Week navigator */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                    disabled={weekOffset === 0}
                    className="booking-nav-btn"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium">
                    {MESES[weekStart.getMonth()]} {weekStart.getFullYear()}
                  </span>
                  <button
                    onClick={() => setWeekOffset(weekOffset + 1)}
                    disabled={weekOffset >= 4}
                    className="booking-nav-btn"
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DIAS_SEMANA.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider pb-1">
                      {d}
                    </div>
                  ))}
                  {weekDays.map((day) => {
                    const available = isDayAvailable(day);
                    const isSelected = selectedDate && dateKey(selectedDate) === dateKey(day);
                    const isToday = dateKey(day) === dateKey(today);
                    return (
                      <button
                        key={dateKey(day)}
                        disabled={!available}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          relative flex flex-col items-center justify-center rounded-xl py-2.5 text-sm font-medium transition-all
                          ${!available ? "text-[hsl(var(--muted-foreground)/0.35)] cursor-not-allowed" : ""}
                          ${available && !isSelected ? "hover:bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--foreground))]" : ""}
                          ${isSelected ? "bg-[hsl(var(--primary))] text-white shadow-md" : ""}
                        `}
                      >
                        {day.getDate()}
                        {isToday && (
                          <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-[hsl(var(--primary))]"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slots grid */}
              {selectedDate && (
                <div className="mt-5">
                  <p className="text-sm font-medium mb-3">
                    <Calendar className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                    {formatDate(selectedDate)}
                  </p>

                  {loadingSlots ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando horarios...
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                      No hay horarios disponibles para este día. Prueba otro día.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => {
                        const isSelected = selectedSlot?.inicio === slot.inicio;
                        return (
                          <button
                            key={slot.inicio}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep("resumen");
                            }}
                            className={`
                              rounded-lg border px-3 py-2.5 text-sm font-medium transition-all
                              ${isSelected
                                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                                : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.04)]"
                              }
                            `}
                          >
                            {formatHora(slot.inicio)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Resumen ──────────────────────────────────── */}
          {step === "resumen" && selectedSlot && selectedDate && (
            <div className="booking-step">
              <button onClick={goBack} className="booking-back">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              <h2 className="booking-title">Confirma tu reserva</h2>
              <p className="booking-subtitle">
                Revisa los datos antes de confirmar tu hora.
              </p>

              <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <div>
                    <p className="text-sm font-medium">{formatDate(selectedDate)}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatHora(selectedSlot.inicio)} — {formatHora(selectedSlot.fin)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <p className="text-sm">{perfil.duracion_minutos} minutos</p>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <p className="text-sm">
                    {tipoPaciente === "EXISTENTE" ? pacienteNombre : nombreCompleto}
                  </p>
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleReservar}
                disabled={reservando}
                className="booking-btn-primary mt-5 w-full"
              >
                {reservando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reservando...
                  </>
                ) : (
                  "Confirmar reserva"
                )}
              </button>
            </div>
          )}

          {/* ── Step: Confirmado ───────────────────────────────── */}
          {step === "confirmado" && reservaResult && (
            <div className="booking-step text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-xl font-bold">¡Tu hora quedó reservada!</h2>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Hemos registrado tu sesión para el{" "}
                <strong>{reservaResult.reserva.fecha}</strong> a las{" "}
                <strong>{reservaResult.reserva.hora}</strong> hrs.
                <br />
                Tu psicólogo/a verá esta reserva en su agenda.
              </p>

              <div className="mt-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                Ya puedes cerrar esta ventana. No necesitas realizar ninguna acción adicional.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[hsl(var(--muted-foreground)/0.5)]">
          Psiconex — Agenda profesional
        </p>
      </div>

      <style jsx>{`
        .booking-page {
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 2rem 1rem;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--primary) / 0.08) 0%, transparent 60%),
            linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.4) 100%);
        }
        .booking-container {
          width: 100%;
          max-width: 480px;
        }
        .booking-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding: 0 0.25rem;
        }
        .booking-avatar {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: hsl(var(--primary-foreground));
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(280 75% 64%) 100%);
          box-shadow: 0 4px 12px -2px hsl(var(--primary) / 0.35);
        }
        .booking-card {
          border-radius: 1.25rem;
          border: 1px solid hsl(var(--border) / 0.7);
          background: hsl(var(--card));
          padding: 1.5rem;
          box-shadow:
            0 1px 0 0 hsl(0 0% 100% / 0.6) inset,
            0 4px 16px -4px hsl(0 0% 0% / 0.08),
            0 12px 32px -8px hsl(0 0% 0% / 0.06);
        }
        .booking-step {
          animation: fade-in-up 0.3s ease-out both;
        }
        .booking-title {
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.3;
        }
        .booking-subtitle {
          margin-top: 0.375rem;
          font-size: 0.8125rem;
          line-height: 1.5;
          color: hsl(var(--muted-foreground));
        }
        .booking-back {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          margin-bottom: 1rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: hsl(var(--muted-foreground));
          transition: color 0.2s;
        }
        .booking-back:hover {
          color: hsl(var(--foreground));
        }
        .booking-label {
          display: block;
          margin-bottom: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: hsl(var(--muted-foreground));
        }
        .booking-input {
          width: 100%;
          border-radius: 0.625rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .booking-input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        .booking-input::placeholder {
          color: hsl(var(--muted-foreground) / 0.5);
        }
        .booking-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-radius: 0.625rem;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: background 0.2s, opacity 0.2s, transform 0.15s;
          cursor: pointer;
        }
        .booking-btn-primary:hover:not(:disabled) {
          background: hsl(var(--primary) / 0.9);
          transform: translateY(-1px);
        }
        .booking-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .booking-type-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 1.5rem 1rem;
          text-align: center;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.25s;
          cursor: pointer;
        }
        .booking-type-card:hover {
          border-color: hsl(var(--primary) / 0.4);
          box-shadow: 0 4px 16px -4px hsl(var(--primary) / 0.15);
          transform: translateY(-2px);
        }
        .booking-type-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(280 75% 64% / 0.08) 100%);
          color: hsl(var(--primary));
          transition: transform 0.3s;
        }
        .booking-type-card:hover .booking-type-icon {
          transform: scale(1.08);
        }
        .booking-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          transition: background 0.15s;
        }
        .booking-nav-btn:hover:not(:disabled) {
          background: hsl(var(--accent));
        }
        .booking-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        @media (prefers-color-scheme: dark) {
          .booking-card {
            box-shadow:
              0 1px 0 0 hsl(0 0% 100% / 0.04) inset,
              0 4px 16px -4px hsl(0 0% 0% / 0.4),
              0 12px 32px -8px hsl(0 0% 0% / 0.3);
          }
        }
      `}</style>
    </main>
  );
}
