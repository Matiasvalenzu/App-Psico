"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Play,
  Send,
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
  fuentes_json: unknown[];
}

interface ChatConversacion {
  id: number;
  titulo: string;
  mensajes?: ChatMensaje[];
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

export default function PacienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMensaje[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentDateTime, setDocumentDateTime] = useState(getDateTimeInputValue());
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

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
      await loadChat();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChat() {
    const listRes = await apiFetch(`/chat/?paciente=${id}`);
    const listData = await listRes.json();
    const conversations: ChatConversacion[] = listData.results || listData;
    if (!conversations.length) return;

    const detailRes = await apiFetch(`/chat/${conversations[0].id}/`);
    const detailData: ChatConversacion = await detailRes.json();
    setChatId(detailData.id);
    setMessages(detailData.mensajes || []);
  }

  async function ensureChatConversation() {
    if (chatId) return chatId;

    const res = await apiFetch("/chat/", {
      method: "POST",
      body: JSON.stringify({
        paciente: parseInt(id),
        titulo: paciente ? `Chat ${paciente.nombre_completo}` : "Chat del paciente",
      }),
    });
    const data: ChatConversacion = await res.json();
    setChatId(data.id);
    return data.id;
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const content = chatInput.trim();
    setChatInput("");
    setSendingChat(true);
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), rol: "USER", contenido: content, fuentes_json: [] },
    ]);

    try {
      const conversationId = await ensureChatConversation();
      const res = await apiFetch(`/chat/${conversationId}/enviar_mensaje/`, {
        method: "POST",
        body: JSON.stringify({ contenido: content }),
      });
      const assistantMessage = await res.json();
      setMessages((prev) => [...prev, assistantMessage]);
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
    }
  }

  async function handleNewSession() {
    try {
      const res = await apiFetch("/sesiones/", {
        method: "POST",
        body: JSON.stringify({ paciente: parseInt(id) }),
      });
      if (res.ok) {
        const sesion = await res.json();
        router.push(
          `/dashboard/pacientes/${id}/sesiones/${sesion.id}`
        );
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
        } catch {
          // Keep generic message.
        }
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
    return <p className="text-muted-foreground">Cargando...</p>;
  }

  if (!paciente) {
    return <p className="text-destructive">Paciente no encontrado</p>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a pacientes
      </button>

      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-bold">{paciente.nombre_completo}</h1>
        {paciente.fecha_nacimiento && (
          <p className="text-sm text-muted-foreground mt-1">
            Nacimiento: {formatDate(paciente.fecha_nacimiento)}
          </p>
        )}
        {paciente.motivo_consulta && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Motivo de consulta
            </p>
            <p className="text-sm mt-1">{paciente.motivo_consulta}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sesiones ({sesiones.length})</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={openDocumentModal}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            Cargar documento
          </button>
          <button
            onClick={handleNewSession}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-4 w-4" />
            Nueva sesión
          </button>
        </div>
      </div>

      {documentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleDocumentUpload}
            className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg"
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
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={documentDateTime}
                  onChange={(event) => setDocumentDateTime(event.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Archivo</span>
                <input
                  type="file"
                  accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) =>
                    setDocumentFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <span className="block text-xs text-muted-foreground">
                  Formatos permitidos: TXT, DOCX y PDF con texto seleccionable.
                </span>
              </label>
            </div>

            {documentError && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {documentError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocumentModalOpen(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploadingDocument}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {uploadingDocument && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploadingDocument ? "Cargando..." : "Cargar documento"}
              </button>
            </div>
          </form>
        </div>
      )}

      {sesiones.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
          <Calendar className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p>Sin sesiones registradas</p>
          <p className="text-xs mt-1">
            Presiona &ldquo;Nueva sesión&rdquo; o carga un documento externo para comenzar
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
                  router.push(
                    `/dashboard/pacientes/${id}/sesiones/${sesion.id}`
                  )
                }
                className="flex items-center gap-4 rounded-lg border bg-card p-4 text-left hover:border-primary/50 transition-colors"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    isExternalDocument
                      ? "bg-violet-50 text-violet-600"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {isExternalDocument ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Calendar className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {formatDate(sesion.fecha_hora_inicio)}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(sesion.fecha_hora_inicio)}
                    </span>
                    {isExternalDocument && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">
                          {sesion.documento_nombre_original || "Documento externo"}
                        </span>
                      </span>
                    )}
                    {!isExternalDocument && sesion.duracion_segundos ? (
                      <span>{formatDuration(sesion.duracion_segundos)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isExternalDocument && (
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                      DOCUMENTO EXTERNO
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      sesion.estado === "COMPLETADO"
                        ? "bg-green-50 text-green-700"
                        : sesion.estado === "PROCESANDO"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sesion.estado}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {paciente.notas_privadas && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Notas privadas
          </p>
          <p className="text-sm whitespace-pre-wrap">
            {paciente.notas_privadas}
          </p>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Chat IA del paciente</h2>
        </div>
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-background p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Haz una pregunta sobre las sesiones transcritas y documentos de este paciente.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg p-3 text-sm ${
                  message.rol === "USER"
                    ? "ml-8 bg-primary text-primary-foreground"
                    : "mr-8 bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.contenido}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={sendChatMessage} className="flex gap-2">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Ej: ¿Qué temas se repiten en las últimas sesiones?"
          />
          <button
            type="submit"
            disabled={sendingChat}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
