"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type {
  DatesSetArg,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Link2,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type AgendaEstado =
  | "PROGRAMADA"
  | "CONFIRMACION_SOLICITADA"
  | "CONFIRMADA"
  | "ANULADA";

type Recurrencia = "NINGUNA" | "SEMANAL" | "QUINCENAL";
type AgendaTipoPaciente = "EXISTENTE" | "PROSPECTO";

interface PacienteOption {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
}

interface AgendaCita {
  id: number;
  paciente: number | null;
  paciente_nombre_completo: string;
  paciente_telefono_whatsapp: string;
  paciente_email_contacto: string;
  prospecto_nombre: string;
  prospecto_apellido: string;
  prospecto_email: string;
  prospecto_telefono_whatsapp: string;
  prospecto_motivo_consulta: string;
  inicio: string;
  fin: string;
  estado: AgendaEstado;
  notas: string;
  motivo_anulacion: string;
  recurrencia: Recurrencia;
  recurrente_hasta: string | null;
  grupo_recurrencia: string | null;
  confirmacion_solicitada_at: string | null;
  confirmada_at: string | null;
  google_synced_at: string | null;
  google_sync_error: string;
}

interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  calendar_name: string;
  calendar_id: string;
  last_synced_at: string | null;
}

const STATUS_LABELS: Record<AgendaEstado, string> = {
  PROGRAMADA: "Programada",
  CONFIRMACION_SOLICITADA: "Confirmación solicitada",
  CONFIRMADA: "Confirmada",
  ANULADA: "Anulada",
};

const STATUS_COLORS: Record<AgendaEstado, { bg: string; border: string; text: string }> = {
  PROGRAMADA: { bg: "#2563eb", border: "#1d4ed8", text: "#ffffff" },
  CONFIRMACION_SOLICITADA: { bg: "#f59e0b", border: "#d97706", text: "#111827" },
  CONFIRMADA: { bg: "#059669", border: "#047857", text: "#ffffff" },
  ANULADA: { bg: "#94a3b8", border: "#64748b", text: "#ffffff" },
};

function toDateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function defaultStartForDate(date: Date) {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return next;
}

function parseApiPathFromNext(nextUrl: string | null) {
  if (!nextUrl) return null;
  const url = new URL(nextUrl);
  return url.pathname.replace(/^\/api/, "") + url.search;
}

export default function AgendaPage() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [citas, setCitas] = useState<AgendaCita[]>([]);
  const [pacientes, setPacientes] = useState<PacienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [viewTitle, setViewTitle] = useState("");
  const [activeView, setActiveView] = useState("dayGridMonth");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCita, setSelectedCita] = useState<AgendaCita | null>(null);
  const [tipoPaciente, setTipoPaciente] = useState<AgendaTipoPaciente>("EXISTENTE");
  const [pacienteId, setPacienteId] = useState("");
  const [prospectoNombre, setProspectoNombre] = useState("");
  const [prospectoApellido, setProspectoApellido] = useState("");
  const [prospectoEmail, setProspectoEmail] = useState("");
  const [prospectoWhatsapp, setProspectoWhatsapp] = useState("");
  const [prospectoMotivo, setProspectoMotivo] = useState("");
  const [inicio, setInicio] = useState("");
  const [notas, setNotas] = useState("");
  const [recurrencia, setRecurrencia] = useState<Recurrencia>("NINGUNA");
  const [recurrenteHasta, setRecurrenteHasta] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  const events = useMemo<EventInput[]>(
    () =>
      citas.map((cita) => {
        const colors = STATUS_COLORS[cita.estado];
        return {
          id: String(cita.id),
          title: cita.paciente_nombre_completo,
          start: cita.inicio,
          end: cita.fin,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: { cita },
        };
      }),
    [citas]
  );

  useEffect(() => {
    loadPacientes();
    loadGoogleStatus();
    syncGoogleCalendar(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_calendar") === "connected") {
      setSuccess("Google Calendar conectado correctamente.");
    }
    if (params.get("google_calendar") === "error") {
      setError("No se pudo conectar Google Calendar.");
    }
  }, []);

  useEffect(() => {
    if (range) loadCitas(range.start, range.end);
  }, [range]);

  async function loadPacientes() {
    try {
      const all: PacienteOption[] = [];
      let path: string | null = "/pacientes/?activo=true&page=1";
      while (path) {
        const res = await apiFetch(path);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (Array.isArray(data)) {
          all.push(...data);
          path = null;
        } else {
          all.push(...(data.results || []));
          path = parseApiPathFromNext(data.next);
        }
      }
      setPacientes(all);
    } catch {
      setError("No se pudieron cargar los pacientes.");
    }
  }

  async function loadGoogleStatus() {
    try {
      const res = await apiFetch("/agenda/google/status/");
      if (!res.ok) throw new Error();
      setGoogleStatus(await res.json());
    } catch {
      setGoogleStatus(null);
    }
  }

  async function connectGoogleCalendar() {
    setGoogleLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch("/agenda/google/connect/");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "No se pudo iniciar la conexión con Google Calendar.");
      }
      window.location.href = data.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la conexión con Google Calendar.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function syncGoogleCalendar(silent = false) {
    setGoogleSyncing(true);
    if (!silent) {
      setError("");
      setSuccess("");
    }
    try {
      const res = await apiFetch("/agenda/google/sync/", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "No se pudo sincronizar Google Calendar.");
      }
      await loadGoogleStatus();
      refreshCitas();
      if (!silent) {
        if (!data.google_to_app?.connected) {
          setError("Conecta Google Calendar antes de sincronizar.");
        } else {
          const imported = data.google_to_app.created || 0;
          const updated = data.google_to_app.updated || 0;
          const pushed = data.app_to_google.synced || 0;
          setSuccess(`Google Calendar sincronizado. Importadas ${imported}, actualizadas ${updated}, enviadas ${pushed}.`);
        }
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "No se pudo sincronizar Google Calendar.");
      }
    } finally {
      setGoogleSyncing(false);
    }
  }

  async function loadCitas(start: string, end: string) {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/agenda/citas/?desde=${encodeURIComponent(start)}&hasta=${encodeURIComponent(end)}`
      );
      if (!res.ok) throw new Error();
      setCitas(await res.json());
    } catch {
      setError("No se pudieron cargar las citas de agenda.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal(startDate: Date) {
    setSelectedCita(null);
    setTipoPaciente("EXISTENTE");
    setPacienteId("");
    setProspectoNombre("");
    setProspectoApellido("");
    setProspectoEmail("");
    setProspectoWhatsapp("");
    setProspectoMotivo("");
    setInicio(toDateTimeInputValue(startDate));
    setNotas("");
    setRecurrencia("NINGUNA");
    setRecurrenteHasta(toDateInputValue(startDate));
    setWhatsappMessage("");
    setError("");
    setModalOpen(true);
  }

  function openEditModal(cita: AgendaCita) {
    setSelectedCita(cita);
    setTipoPaciente(cita.paciente ? "EXISTENTE" : "PROSPECTO");
    setPacienteId(cita.paciente ? String(cita.paciente) : "");
    setProspectoNombre(cita.prospecto_nombre || "");
    setProspectoApellido(cita.prospecto_apellido || "");
    setProspectoEmail(cita.prospecto_email || "");
    setProspectoWhatsapp(cita.prospecto_telefono_whatsapp || "");
    setProspectoMotivo(cita.prospecto_motivo_consulta || "");
    setInicio(toDateTimeInputValue(new Date(cita.inicio)));
    setNotas(cita.notas || "");
    setRecurrencia(cita.recurrencia || "NINGUNA");
    setRecurrenteHasta(cita.recurrente_hasta || toDateInputValue(new Date(cita.inicio)));
    setWhatsappMessage("");
    setError("");
    setModalOpen(true);
  }

  function handleSelect(info: DateSelectArg) {
    const startDate = info.allDay ? defaultStartForDate(info.start) : info.start;
    openCreateModal(startDate);
  }

  function handleEventClick(info: EventClickArg) {
    openEditModal(info.event.extendedProps.cita as AgendaCita);
  }

  async function handleEventDrop(info: EventDropArg) {
    const cita = info.event.extendedProps.cita as AgendaCita;
    if (!info.event.start) return;
    try {
      const res = await apiFetch(`/agenda/citas/${cita.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ inicio: info.event.start.toISOString() }),
      });
      if (!res.ok) {
        info.revert();
        const data = await res.json().catch(() => null);
        setError(data?.error || "No se pudo mover la cita.");
        return;
      }
      setSuccess("Cita movida correctamente.");
      refreshCitas();
    } catch {
      info.revert();
      setError("No se pudo mover la cita.");
    }
  }

  function handleDatesSet(info: DatesSetArg) {
    setRange({ start: info.start.toISOString(), end: info.end.toISOString() });
    setViewTitle(info.view.title);
    setActiveView(info.view.type);
  }

  function changeView(view: string) {
    calendarRef.current?.getApi().changeView(view);
    setActiveView(view);
  }

  function navigate(direction: "prev" | "next" | "today") {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (direction === "prev") api.prev();
    if (direction === "next") api.next();
    if (direction === "today") api.today();
  }

  function refreshCitas() {
    if (range) loadCitas(range.start, range.end);
  }

  async function saveCita(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (tipoPaciente === "EXISTENTE" && !pacienteId) {
        throw new Error("Selecciona un paciente para agendar la cita.");
      }
      if (tipoPaciente === "PROSPECTO" && (!prospectoNombre.trim() || !prospectoApellido.trim())) {
        throw new Error("Ingresa nombre y apellido del posible paciente.");
      }

      const payload: Record<string, unknown> = {
        inicio: new Date(inicio).toISOString(),
        notas,
      };
      if (tipoPaciente === "EXISTENTE") {
        payload.paciente = Number(pacienteId);
      } else {
        payload.paciente = null;
        payload.prospecto_nombre = prospectoNombre.trim();
        payload.prospecto_apellido = prospectoApellido.trim();
        payload.prospecto_email = prospectoEmail.trim();
        payload.prospecto_telefono_whatsapp = prospectoWhatsapp.trim();
        payload.prospecto_motivo_consulta = prospectoMotivo.trim();
      }
      if (!selectedCita) {
        payload.recurrencia = recurrencia;
        if (recurrencia !== "NINGUNA") payload.recurrente_hasta = recurrenteHasta;
      }

      const res = await apiFetch(
        selectedCita ? `/agenda/citas/${selectedCita.id}/` : "/agenda/citas/",
        {
          method: selectedCita ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No se pudo guardar la cita.");
      }
      setModalOpen(false);
      setSuccess(selectedCita ? "Cita actualizada." : "Cita agendada correctamente.");
      refreshCitas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cita.");
    } finally {
      setSaving(false);
    }
  }

  async function crearFichaDesdeCita() {
    if (!selectedCita) return;
    setCreatingPatient(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/agenda/citas/${selectedCita.id}/crear_paciente/`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear la ficha del paciente.");
      }
      await loadPacientes();
      setModalOpen(false);
      setSuccess(`Ficha creada para ${data.paciente.nombre_completo}.`);
      refreshCitas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la ficha del paciente.");
    } finally {
      setCreatingPatient(false);
    }
  }

  async function anularCita() {
    if (!selectedCita) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/agenda/citas/${selectedCita.id}/anular/`, {
        method: "POST",
        body: JSON.stringify({ motivo_anulacion: "Anulada desde agenda" }),
      });
      if (!res.ok) throw new Error();
      setModalOpen(false);
      setSuccess("Cita anulada. El bloque queda disponible para agendar otra sesión.");
      refreshCitas();
    } catch {
      setError("No se pudo anular la cita.");
    } finally {
      setSaving(false);
    }
  }

  async function marcarConfirmada() {
    if (!selectedCita) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/agenda/citas/${selectedCita.id}/marcar_confirmada/`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSelectedCita(updated);
      setSuccess("Cita marcada como confirmada.");
      refreshCitas();
    } catch {
      setError("No se pudo confirmar la cita.");
    } finally {
      setSaving(false);
    }
  }

  async function solicitarConfirmacion() {
    if (!selectedCita) return;
    setSaving(true);
    setWhatsappMessage("");
    try {
      const res = await apiFetch(`/agenda/citas/${selectedCita.id}/solicitar_confirmacion/`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedCita(data);
      setWhatsappMessage(data.mensaje_whatsapp || "");
      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
        setSuccess("Confirmación solicitada. Envía el mensaje abierto en WhatsApp.");
      } else {
        setSuccess("Confirmación solicitada. La cita no tiene teléfono WhatsApp registrado.");
      }
      refreshCitas();
    } catch {
      setError("No se pudo generar la solicitud de confirmación.");
    } finally {
      setSaving(false);
    }
  }

  const activeButton = (view: string) =>
    activeView === view
      ? "bg-primary text-primary-foreground"
      : "border border-border bg-card text-foreground hover:bg-accent";

  const selectedStatus = selectedCita?.estado || "PROGRAMADA";
  const selectedPatient = pacientes.find((p) => String(p.id) === pacienteId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
              <p className="text-sm text-muted-foreground">
                Agenda pacientes con ficha o posibles pacientes y solicita confirmaciones por WhatsApp.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {googleStatus?.connected ? (
            <button
              type="button"
              onClick={() => syncGoogleCalendar(false)}
              disabled={googleSyncing}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-subtle transition-all hover:bg-accent disabled:opacity-50"
            >
              {googleSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar Google
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogleCalendar}
              disabled={googleLoading || googleStatus?.configured === false}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary shadow-subtle transition-all hover:bg-primary/15 disabled:opacity-50"
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar Google
            </button>
          )}
          <button
            type="button"
            onClick={() => openCreateModal(defaultStartForDate(new Date()))}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Crear cita
          </button>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            error
              ? "border-destructive/20 bg-destructive/5 text-destructive"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <button
            type="button"
            onClick={() => openCreateModal(defaultStartForDate(new Date()))}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium shadow-subtle transition-colors hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Crear
          </button>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Google Calendar
            </p>
            <p className="mt-1 text-sm font-medium">
              {googleStatus?.connected ? googleStatus.calendar_name : "No conectado"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {googleStatus?.configured === false
                ? "Faltan credenciales OAuth de Google."
                : googleStatus?.connected
                  ? `Última sync: ${googleStatus.last_synced_at ? new Date(googleStatus.last_synced_at).toLocaleString("es-CL") : "pendiente"}`
                  : "Sincroniza con el calendario dedicado Agenda Psicológica."}
            </p>
            <div className="mt-3 grid gap-2">
              {googleStatus?.connected ? (
                <button
                  type="button"
                  onClick={() => syncGoogleCalendar(false)}
                  disabled={googleSyncing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {googleSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sincronizar ahora
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connectGoogleCalendar}
                  disabled={googleLoading || googleStatus?.configured === false}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                >
                  {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Conectar Google
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resumen visible
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span>Programadas</span>
                <strong>{citas.filter((c) => c.estado === "PROGRAMADA").length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span>Por confirmar</span>
                <strong>{citas.filter((c) => c.estado === "CONFIRMACION_SOLICITADA").length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span>Confirmadas</span>
                <strong>{citas.filter((c) => c.estado === "CONFIRMADA").length}</strong>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            Las citas de posibles pacientes permiten crear la ficha después con los datos ya ingresados.
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("today")}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => navigate("prev")}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate("next")}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <h2 className="min-w-[180px] text-xl font-semibold capitalize tracking-tight">
                {viewTitle}
              </h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex rounded-xl border border-border bg-muted/30 p-1 text-sm">
              <button
                type="button"
                onClick={() => changeView("dayGridMonth")}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${activeButton("dayGridMonth")}`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => changeView("timeGridWeek")}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${activeButton("timeGridWeek")}`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => changeView("timeGridDay")}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${activeButton("timeGridDay")}`}
              >
                Día
              </button>
            </div>
          </div>

          <div className="agenda-calendar p-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={esLocale}
              headerToolbar={false}
              height="auto"
              firstDay={1}
              weekends
              selectable
              selectMirror
              editable
              eventDurationEditable={false}
              allDaySlot={false}
              slotMinTime="08:00:00"
              slotMaxTime="20:00:00"
              slotDuration="01:00:00"
              snapDuration="01:00:00"
              businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "20:00" }}
              events={events}
              select={handleSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              datesSet={handleDatesSet}
              eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false }}
              slotLabelFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false }}
              dayMaxEvents={3}
            />
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedCita ? "Editar cita" : "Agendar cita"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Bloque fijo de 1 hora
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveCita} className="space-y-4 p-5">
              <div className="space-y-3">
                <span className="text-sm font-medium">Tipo de agenda</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTipoPaciente("EXISTENTE")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      tipoPaciente === "EXISTENTE"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    Paciente existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoPaciente("PROSPECTO")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      tipoPaciente === "PROSPECTO"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    Posible paciente
                  </button>
                </div>
              </div>

              {tipoPaciente === "EXISTENTE" ? (
                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Paciente</span>
                  <select
                    value={pacienteId}
                    onChange={(e) => setPacienteId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecciona un paciente</option>
                    {pacientes.map((paciente) => (
                      <option key={paciente.id} value={paciente.id}>
                        {paciente.nombre_completo || `${paciente.nombre} ${paciente.apellido}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium">Nombre</span>
                      <input
                        value={prospectoNombre}
                        onChange={(e) => setProspectoNombre(e.target.value)}
                        required={tipoPaciente === "PROSPECTO"}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Nombre"
                      />
                    </label>
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium">Apellido</span>
                      <input
                        value={prospectoApellido}
                        onChange={(e) => setProspectoApellido(e.target.value)}
                        required={tipoPaciente === "PROSPECTO"}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Apellido"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium">Email</span>
                      <input
                        type="email"
                        value={prospectoEmail}
                        onChange={(e) => setProspectoEmail(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="correo@ejemplo.com"
                      />
                    </label>
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium">WhatsApp</span>
                      <input
                        value={prospectoWhatsapp}
                        onChange={(e) => setProspectoWhatsapp(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Ej: +56 9 1234 5678"
                      />
                    </label>
                  </div>
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium">Motivo de consulta</span>
                    <textarea
                      value={prospectoMotivo}
                      onChange={(e) => setProspectoMotivo(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Motivo inicial de consulta..."
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Inicio</span>
                  <input
                    type="datetime-local"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Duración</span>
                  <div className="flex h-[42px] items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    1 hora
                  </div>
                </div>
              </div>

              {!selectedCita && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium">Recurrencia</span>
                    <select
                      value={recurrencia}
                      onChange={(e) => setRecurrencia(e.target.value as Recurrencia)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="NINGUNA">No repetir</option>
                      <option value="SEMANAL">Todas las semanas</option>
                      <option value="QUINCENAL">Cada dos semanas</option>
                    </select>
                  </label>
                  {recurrencia !== "NINGUNA" && (
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium">Repetir hasta</span>
                      <input
                        type="date"
                        value={recurrenteHasta}
                        onChange={(e) => setRecurrenteHasta(e.target.value)}
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  )}
                </div>
              )}

              {selectedCita && (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Estado actual: <span className="font-medium text-foreground">{STATUS_LABELS[selectedStatus]}</span>
                  {selectedCita.grupo_recurrencia && " · Cita generada por recurrencia"}
                </div>
              )}

              <label className="space-y-2 block">
                <span className="text-sm font-medium">Comentarios adicionales</span>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Comentarios breves para la agenda..."
                />
              </label>

              {selectedPatient && (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Paciente seleccionado: {selectedPatient.nombre_completo}
                </div>
              )}

              {selectedCita && !selectedCita.paciente && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  Esta cita corresponde a un posible paciente. Puedes crear su ficha desde aquí si decide atenderse.
                </div>
              )}

              {whatsappMessage && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {whatsappMessage}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedCita && (
                    <>
                      {!selectedCita.paciente && (
                        <button
                          type="button"
                          onClick={crearFichaDesdeCita}
                          disabled={saving || creatingPatient}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                        >
                          {creatingPatient ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          Crear ficha
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={solicitarConfirmacion}
                        disabled={saving || creatingPatient}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={marcarConfirmada}
                        disabled={saving || creatingPatient}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <Check className="h-4 w-4" />
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={anularCita}
                        disabled={saving || creatingPatient}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Anular
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || creatingPatient}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .agenda-calendar .fc {
          --fc-border-color: hsl(var(--border));
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: hsl(var(--muted) / 0.35);
          --fc-today-bg-color: hsl(var(--primary) / 0.08);
          color: hsl(var(--foreground));
        }
        .agenda-calendar .fc-theme-standard td,
        .agenda-calendar .fc-theme-standard th {
          border-color: hsl(var(--border));
        }
        .agenda-calendar .fc-col-header-cell {
          background: hsl(var(--muted) / 0.45);
          padding: 8px 0;
          font-size: 12px;
          text-transform: uppercase;
        }
        .agenda-calendar .fc-daygrid-day-number,
        .agenda-calendar .fc-timegrid-slot-label {
          color: hsl(var(--foreground));
          font-size: 13px;
        }
        .agenda-calendar .fc-event {
          border-radius: 8px;
          border-width: 1px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          padding: 1px 3px;
        }
        .agenda-calendar .fc-daygrid-day-frame {
          min-height: 116px;
        }
        .agenda-calendar .fc-timegrid-slot {
          height: 3rem;
        }
      `}</style>
    </div>
  );
}
