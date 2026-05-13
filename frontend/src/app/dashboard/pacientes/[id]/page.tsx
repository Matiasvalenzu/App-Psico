"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import { ArrowLeft, Calendar, Clock, MessageCircle, Play, Send } from "lucide-react";

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
        <button
          onClick={handleNewSession}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Play className="h-4 w-4" />
          Nueva sesión
        </button>
      </div>

      {sesiones.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
          <Calendar className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p>Sin sesiones registradas</p>
          <p className="text-xs mt-1">
            Presiona &ldquo;Nueva sesión&rdquo; para comenzar
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sesiones.map((sesion) => (
            <button
              key={sesion.id}
              onClick={() =>
                router.push(
                  `/dashboard/pacientes/${id}/sesiones/${sesion.id}`
                )
              }
              className="flex items-center gap-4 rounded-lg border bg-card p-4 text-left hover:border-primary/50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {formatDate(sesion.fecha_hora_inicio)}
                </p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(sesion.fecha_hora_inicio)}
                  </span>
                  {sesion.duracion_segundos ? (
                    <span>{formatDuration(sesion.duracion_segundos)}</span>
                  ) : null}
                </div>
              </div>
              <div>
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
          ))}
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
              Haz una pregunta sobre las sesiones transcritas de este paciente.
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
