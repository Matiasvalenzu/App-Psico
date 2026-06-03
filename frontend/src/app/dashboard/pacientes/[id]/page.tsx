"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowUp,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  motivo_consulta: string;
  notas_privadas: string;
  activo: boolean;
  created_at: string;
}

interface Sesion {
  id: number;
  fecha_hora_inicio: string;
  duracion_segundos: number | null;
  origen: "AUDIO" | "DOCUMENTO_EXTERNO";
  documento_nombre_original: string;
  estado: string;
}

interface ChatMensaje {
  id: number;
  rol: "USER" | "ASSISTANT";
  contenido: string;
  fuentes_json: Array<{
    segmento_id: number;
    sesion_id: number;
    fecha: string;
    origen: string;
    documento_nombre_original: string;
    hablante: string;
    texto: string;
  }>;
}

interface ChatConversacion {
  id: number;
  paciente: number;
  titulo: string;
  mensajes_count?: number;
  mensajes?: ChatMensaje[];
  created_at: string;
  updated_at: string;
}

function getDateTimeInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function getApiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const entries = Object.values(data as Record<string, unknown>);
  const first = entries[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  if (typeof first === "string") return first;
  return fallback;
}

function deduplicateSources(
  sources: Array<{ sesion_id: number; fecha: string; origen: string; documento_nombre_original: string; hablante: string; texto: string }>
) {
  const seen = new Map<number, (typeof sources)[0]>();
  for (const src of sources) {
    if (!seen.has(src.sesion_id)) {
      seen.set(src.sesion_id, src);
    }
  }
  return Array.from(seen.values());
}

function formatChatOption(conversation: ChatConversacion) {
  const title = conversation.titulo || "Nueva conversación";
  const count = conversation.mensajes_count ?? 0;
  return `${title} (${count} mens.)`;
}

function formatRelativeTime(dateString: string) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function getStatusBadge(status: string) {
  if (status === "COMPLETADO") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  if (status === "PROCESANDO") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "bg-muted text-muted-foreground";
}

function getStatusLabel(status: string) {
  if (status === "COMPLETADO") return "Completado";
  if (status === "PROCESANDO") return "Procesando";
  if (status === "PENDIENTE") return "Pendiente";
  if (status === "ERROR") return "Error";
  return status;
}

// ------------ CHAT IA + PAGE ------------

export default function PacienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);

  // Chat state
  const [chatConversations, setChatConversations] = useState<ChatConversacion[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chatTitle, setChatTitle] = useState("");
  const [messages, setMessages] = useState<ChatMensaje[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [savingChatTitle, setSavingChatTitle] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [iaTyping, setIaTyping] = useState(false);
  const [showChatControls, setShowChatControls] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

  // Document modal
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentDateTime, setDocumentDateTime] = useState(getDateTimeInputValue());
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState("");

  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, iaTyping]);

  async function loadData() {
    try {
      const [pacRes, sesRes] = await Promise.all([
        apiFetch(`/pacientes/${id}/`),
        apiFetch(`/sesiones/?paciente=${id}`),
      ]);
      const pacData = await pacRes.json();
      const sesData = await sesRes.json();
      setPaciente(pacData);
      setSesiones(sesData.results || sesData);
      await loadChatConversations();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Chat logic ----------

  function getChatTitle(conversation: ChatConversacion | null) {
    if (!conversation) return "Nueva conversación";
    return conversation.titulo || "Nueva conversación";
  }

  async function loadChatConversations(preferredChatId?: number) {
    setLoadingChat(true);
    setChatError("");
    try {
      const listRes = await apiFetch(`/chat/?paciente=${id}`);
      const listData = await listRes.json();
      const conversations: ChatConversacion[] = listData.results || listData;
      setChatConversations(conversations);

      if (!conversations.length) {
        setChatId(null);
        setChatTitle("");
        setMessages([]);
        return;
      }

      const selected =
        conversations.find((c) => c.id === preferredChatId) ||
        conversations.find((c) => c.id === chatId) ||
        conversations[0];

      await loadChatConversation(selected.id, conversations);
    } catch (err) {
      console.error(err);
      setChatError("No se pudieron cargar las conversaciones IA.");
    } finally {
      setLoadingChat(false);
    }
  }

  async function loadChatConversation(
    conversationId: number,
    knownConversations = chatConversations
  ) {
    setLoadingChat(true);
    setChatError("");
    try {
      const detailRes = await apiFetch(`/chat/${conversationId}/`);
      if (!detailRes.ok) {
        setChatError("No se pudo cargar la conversación seleccionada.");
        return;
      }
      const detailData: ChatConversacion = await detailRes.json();
      setChatId(detailData.id);
      setChatTitle(getChatTitle(detailData));
      setMessages(detailData.mensajes || []);
      setChatConversations((prev) => {
        const base = knownConversations.length ? knownConversations : prev;
        return base.map((c) =>
          c.id === detailData.id
            ? {
                ...c,
                titulo: detailData.titulo,
                updated_at: detailData.updated_at,
                mensajes_count: detailData.mensajes?.length ?? c.mensajes_count,
              }
            : c
        );
      });
    } catch (err) {
      console.error(err);
      setChatError("No se pudo cargar la conversación seleccionada.");
    } finally {
      setLoadingChat(false);
    }
  }

  async function createChatConversation() {
    setCreatingChat(true);
    setChatError("");
    try {
      const res = await apiFetch("/chat/", {
        method: "POST",
        body: JSON.stringify({ paciente: parseInt(id), titulo: "" }),
      });
      if (!res.ok) {
        setChatError("No se pudo crear una nueva conversación.");
        return null;
      }
      const data: ChatConversacion = await res.json();
      await loadChatConversations(data.id);
      return data.id;
    } catch (err) {
      console.error(err);
      setChatError("No se pudo crear una nueva conversación.");
      return null;
    } finally {
      setCreatingChat(false);
    }
  }

  async function ensureChatConversation() {
    if (chatId) return chatId;
    return createChatConversation();
  }

  async function saveChatTitle() {
    if (!chatId) return;
    setSavingChatTitle(true);
    setChatError("");
    try {
      const res = await apiFetch(`/chat/${chatId}/`, {
        method: "PATCH",
        body: JSON.stringify({ titulo: chatTitle.trim() || "Nueva conversación" }),
      });
      if (!res.ok) {
        setChatError("No se pudo guardar el nombre de la conversación.");
        return;
      }
      const data: ChatConversacion = await res.json();
      setChatTitle(getChatTitle(data));
      await loadChatConversations(data.id);
    } catch (err) {
      console.error(err);
      setChatError("No se pudo guardar el nombre de la conversación.");
    } finally {
      setSavingChatTitle(false);
    }
  }

  function toggleSources(messageId: number) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const content = chatInput.trim();
    setChatInput("");
    setSendingChat(true);
    setIaTyping(true);

    const tempId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, rol: "USER", contenido: content, fuentes_json: [] },
    ]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const conversationId = await ensureChatConversation();
      if (!conversationId) {
        setIaTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            rol: "ASSISTANT",
            contenido: "No se pudo crear una conversación para enviar el mensaje.",
            fuentes_json: [],
          },
        ]);
        return;
      }
      const res = await apiFetch(`/chat/${conversationId}/enviar_mensaje/`, {
        method: "POST",
        body: JSON.stringify({ contenido: content }),
      });
      const assistantMessage = await res.json();
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId);
        const realUser = assistantMessage.id
          ? { id: tempId, rol: "USER" as const, contenido: content, fuentes_json: [] }
          : null;
        return [...(realUser ? [...filtered, realUser] : filtered), assistantMessage];
      });
      await loadChatConversations(conversationId);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          rol: "ASSISTANT",
          contenido: "No se pudo consultar el asistente IA.",
          fuentes_json: [],
        },
      ]);
    } finally {
      setSendingChat(false);
      setIaTyping(false);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(e as unknown as React.FormEvent);
    }
  }

  // ---------- Sessions & Documents ----------

  async function handleNewSession() {
    try {
      const res = await apiFetch("/sesiones/", {
        method: "POST",
        body: JSON.stringify({ paciente: parseInt(id) }),
      });
      if (res.ok) {
        const sesion = await res.json();
        router.push(`/dashboard/pacientes/${id}/sesiones/${sesion.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openDocumentModal() {
    setDocumentDateTime(getDateTimeInputValue());
    setDocumentFile(null);
    setDocumentError("");
    setDocumentModalOpen(true);
  }

  async function handleDocumentUpload(e: React.FormEvent) {
    e.preventDefault();
    setDocumentError("");
    if (!documentFile) {
      setDocumentError("Selecciona un archivo TXT, DOCX o PDF.");
      return;
    }
    if (!documentDateTime) {
      setDocumentError("Selecciona fecha y hora para el documento.");
      return;
    }
    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append("paciente", id);
      formData.append("fecha_hora_inicio", new Date(documentDateTime).toISOString());
      formData.append("archivo", documentFile);
      const res = await apiFetch("/sesiones/upload_documento/", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let message = "No se pudo cargar el documento.";
        try {
          message = getApiErrorMessage(await res.json(), message);
        } catch {}
        setDocumentError(message);
        return;
      }
      setDocumentModalOpen(false);
      setDocumentFile(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setDocumentError("No se pudo cargar el documento.");
    } finally {
      setUploadingDocument(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    );
  }

  if (!paciente) {
    return <p className="text-destructive">Paciente no encontrado</p>;
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        onClick={() => router.push("/dashboard")}
        className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a pacientes
      </button>

      {/* Patient header */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
        <h1 className="text-2xl font-bold tracking-tight">
          {paciente.nombre_completo}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {paciente.fecha_nacimiento && (
            <span>Nacimiento: {formatDate(paciente.fecha_nacimiento)}</span>
          )}
        </div>
        {paciente.motivo_consulta && (
          <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Motivo de consulta
            </p>
            <p className="mt-1 text-sm">{paciente.motivo_consulta}</p>
          </div>
        )}
      </div>

      {/* Sessions header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Sesiones ({sesiones.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={openDocumentModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-subtle transition-all hover:bg-accent hover:shadow-card"
          >
            <Upload className="h-4 w-4" />
            Cargar documento
          </button>
          <button
            onClick={handleNewSession}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card"
          >
            <Play className="h-4 w-4" />
            Nueva sesión
          </button>
        </div>
      </div>

      {/* Document modal */}
      {documentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleDocumentUpload}
            className="w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-elevated"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Cargar documento externo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se guardará como una sesión completada dentro del historial del paciente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDocumentModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={documentDateTime}
                  onChange={(event) => setDocumentDateTime(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Archivo</span>
                <input
                  type="file"
                  accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                />
                <span className="block text-xs text-muted-foreground">
                  Formatos permitidos: TXT, DOCX y PDF con texto seleccionable.
                </span>
              </label>
            </div>
            {documentError && (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {documentError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocumentModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploadingDocument}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {uploadingDocument && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploadingDocument ? "Cargando..." : "Cargar documento"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions list */}
      {sesiones.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center shadow-subtle">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Sin sesiones registradas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Presiona &ldquo;Nueva sesión&rdquo; o carga un documento externo
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sesiones.map((sesion) => {
            const isExternalDocument = sesion.origen === "DOCUMENTO_EXTERNO";
            return (
              <button
                key={sesion.id}
                onClick={() =>
                  router.push(`/dashboard/pacientes/${id}/sesiones/${sesion.id}`)
                }
                className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left shadow-subtle transition-all hover:border-primary/30 hover:shadow-card hover:-translate-y-0.5"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                    isExternalDocument
                      ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {isExternalDocument ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Calendar className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatDate(sesion.fecha_hora_inicio)}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(sesion.fecha_hora_inicio)}
                    </span>
                    {isExternalDocument && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <FileText className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {sesion.documento_nombre_original || "Documento externo"}
                        </span>
                      </span>
                    )}
                    {!isExternalDocument && sesion.duracion_segundos
                      ? formatDuration(sesion.duracion_segundos)
                      : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isExternalDocument && (
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      Documento
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(sesion.estado)}`}
                  >
                    {getStatusLabel(sesion.estado)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Private notes */}
      {paciente.notas_privadas && (
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-subtle">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notas privadas
          </p>
          <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">
            {paciente.notas_privadas}
          </p>
        </div>
      )}

      {/* ──────────────────────────────────────────────── */}
      {/*  CHAT IA  –  EL DIAMANTE                        */}
      {/* ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 chat-glow space-y-4">
        {/* Chat Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-glow">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Chat IA del paciente
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
                  IA
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Analiza sesiones transcritas y documentos del paciente con IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChatControls(!showChatControls)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-subtle transition-all hover:bg-accent"
            >
              {showChatControls ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Controles
            </button>
            <button
              type="button"
              onClick={createChatConversation}
              disabled={creatingChat}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card disabled:opacity-50"
            >
              {creatingChat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Nueva
            </button>
          </div>
        </div>

        {/* Collapsible Controls */}
        {showChatControls && (
          <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 animate-fade-in-up sm:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conversación
              </span>
              <select
                value={chatId ?? ""}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (value) loadChatConversation(value);
                }}
                disabled={loadingChat || chatConversations.length === 0}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                {chatConversations.length === 0 ? (
                  <option value="">Sin conversaciones</option>
                ) : (
                  chatConversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatChatOption(c)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nombre
              </span>
              <div className="flex gap-2">
                <input
                  value={chatTitle}
                  onChange={(event) => setChatTitle(event.target.value)}
                  disabled={!chatId}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  placeholder="Ej: Hipótesis inicial..."
                />
              </div>
            </label>
            <button
              type="button"
              onClick={saveChatTitle}
              disabled={!chatId || savingChatTitle}
              className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-subtle transition-all hover:bg-accent disabled:opacity-50"
            >
              {savingChatTitle ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          </div>
        )}

        {chatError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
            {chatError}
          </div>
        )}

        {/* Message Area */}
        <div className="min-h-[280px] max-h-[460px] space-y-4 overflow-y-auto rounded-xl bg-muted/30 p-4 transition-all">
          {loadingChat ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando conversación...
            </div>
          ) : !chatId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Crea una conversación para empezar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La IA analizará las sesiones y documentos de este paciente
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">
                ¿En qué puedo ayudarte con {paciente.nombre}?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pregunta sobre patrones, temas recurrentes o cualquier aspecto clínico
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isUser = message.rol === "USER";
              const sources = deduplicateSources(message.fuentes_json || []);
              const sourcesOpen = expandedSources.has(message.id);
              const isLatest =
                index === messages.length - 1;

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-fade-in-up ${
                    isUser ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      isUser
                        ? "bg-primary/10 text-primary"
                        : "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
                    }`}
                  >
                    {isUser ? (
                      <span className="text-xs font-bold">
                        {paciente?.nombre.charAt(0).toUpperCase() || "P"}
                      </span>
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] space-y-1 ${isUser ? "items-end" : ""}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "rounded-tr-md bg-primary text-primary-foreground shadow-subtle"
                          : "rounded-tl-md border border-border/60 bg-card text-foreground shadow-subtle"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.contenido}</p>
                    </div>

                    {/* Timestamp */}
                    <p
                      className={`text-xs text-muted-foreground ${
                        isUser ? "text-right" : "text-left"
                      }`}
                    >
                      {message.id > 9999999 ? "ahora" : ""}
                    </p>

                    {/* Sources (AI only) */}
                    {!isUser && sources.length > 0 && (
                      <div className="mt-1">
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <FileText className="h-3 w-3" />
                          Fuentes ({sources.length})
                          {sourcesOpen ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        {sourcesOpen && (
                          <div className="mt-2 space-y-2 animate-fade-in-up">
                            {sources.map((src, i) => (
                              <div
                                key={i}
                                className="rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                              >
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                  <FileText className="h-3 w-3 text-violet-500" />
                                  {src.origen === "DOCUMENTO_EXTERNO"
                                    ? src.documento_nombre_original || "Documento"
                                    : `Sesión ${src.fecha}`}
                                  {src.hablante && (
                                    <span className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
                                      {src.hablante === "PSICOLOGO"
                                        ? "Psicólogo"
                                        : src.hablante === "PACIENTE"
                                          ? "Paciente"
                                          : src.hablante}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 line-clamp-3">{src.texto}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {iaTyping && (
            <div className="flex animate-fade-in-up items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border/60 bg-card px-4 py-3 shadow-subtle">
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-typing-dot" />
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-typing-dot" />
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={sendChatMessage} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sendingChat || creatingChat}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            placeholder={
              chatId
                ? `Pregunta sobre las sesiones de ${paciente.nombre}...`
                : "Crea una conversación para empezar"
            }
          />
          <button
            type="submit"
            disabled={sendingChat || creatingChat || !chatInput.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sendingChat ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
