"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import AvisoConsentimiento from "@/components/pacientes/AvisoConsentimiento";
import {
  ArrowUp,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  CHAT_SUGGESTED_PROMPTS,
  cleanMarkdownEmphasis,
  deduplicateSources,
  formatRelativeTime,
  type ChatConversacion,
  type ChatMensaje,
  type Paciente,
} from "./utils";

// Chat IA del paciente: conversaciones, mensajes y guardado de respuestas como informe.
export default function ChatIA({
  pacienteId: id,
  paciente,
  onInformeSaved,
}: {
  pacienteId: string;
  paciente: Paciente;
  onInformeSaved: () => void;
}) {
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
  const [chatToDelete, setChatToDelete] = useState<ChatConversacion | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<number | null>(null);
  const [editingConversationTitle, setEditingConversationTitle] = useState("");
  const [savingInformeId, setSavingInformeId] = useState<number | null>(null);

  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsChatSidebarOpen(false);
    loadChatConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!messages.length || !chatScrollContainerRef.current) return;
    chatScrollContainerRef.current.scrollTo({
      top: chatScrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, iaTyping]);

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

  async function saveMessageAsInforme(message: ChatMensaje) {
    setSavingInformeId(message.id);
    setChatError("");
    try {
      const res = await apiFetch("/chat/informes/", {
        method: "POST",
        body: JSON.stringify({
          paciente: parseInt(id),
          mensaje_origen: message.id,
          tipo: "RESUMEN_CLINICO",
          titulo: chatTitle && chatTitle !== "Nueva conversación" ? chatTitle : "Resumen clínico IA",
        }),
      });
      if (!res.ok) {
        setChatError("No se pudo guardar la respuesta como informe.");
        return;
      }
      onInformeSaved();
      toast.success("Informe IA guardado en Documentos e informes.");
    } catch (err) {
      console.error(err);
      setChatError("No se pudo guardar la respuesta como informe.");
    } finally {
      setSavingInformeId(null);
    }
  }

  async function deleteChatConversation() {
    if (!chatToDelete) return;
    setDeletingChat(true);
    setChatError("");
    try {
      const res = await apiFetch(`/chat/${chatToDelete.id}/`, { method: "DELETE" });
      if (!res.ok) {
        setChatError("No se pudo eliminar la conversación IA.");
        return;
      }
      setChatToDelete(null);
      setChatId(null);
      setChatTitle("");
      setMessages([]);
      await loadChatConversations();
    } catch (err) {
      console.error(err);
      setChatError("No se pudo eliminar la conversación IA.");
    } finally {
      setDeletingChat(false);
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

  function selectSuggestedChatPrompt(prompt: string) {
    setChatInput(prompt);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
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

  return (
    <>
      {/* ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl border border-border/60 bg-card chat-glow overflow-clip">
        <div className="flex h-[calc(100dvh-16rem)] min-h-[520px]">

          {/* ── Chat Sidebar (Historial) ── */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isChatSidebarOpen
                ? "absolute inset-0 z-30 bg-card flex flex-col md:relative md:inset-auto md:z-auto md:w-72 md:min-w-[288px] md:border-r md:border-border/60 md:bg-muted/20"
                : "hidden md:flex md:w-0 md:min-w-0 md:border-r-0"
            }`}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-border/40">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold truncate">Conversaciones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={createChatConversation}
                  disabled={creatingChat}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
                  title="Nueva conversación"
                >
                  {creatingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsChatSidebarOpen(false)}
                  className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Cerrar historial"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {chatConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Sin conversaciones</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Crea una para empezar</p>
                </div>
              ) : (
                chatConversations.map((conv) => {
                  const isActive = conv.id === chatId;
                  const isEditing = editingConversationId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={`group relative flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (!isEditing) {
                          loadChatConversation(conv.id);
                          if (typeof window !== "undefined" && window.innerWidth < 768) {
                            setIsChatSidebarOpen(false);
                          }
                        }
                      }}
                    >
                      <MessageCircle className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />

                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingConversationTitle}
                          onChange={(e) => setEditingConversationTitle(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setChatTitle(editingConversationTitle);
                              await saveChatTitle();
                              setEditingConversationId(null);
                            } else if (e.key === "Escape") {
                              setEditingConversationId(null);
                            }
                          }}
                          onBlur={() => setEditingConversationId(null)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-background border border-input rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-sm leading-tight">
                            {conv.titulo || "Nueva conversación"}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {formatRelativeTime(conv.updated_at)} · {conv.mensajes_count ?? 0} msgs
                          </p>
                        </div>
                      )}

                      {/* Context actions (visible on hover or when active) */}
                      {!isEditing && (
                        <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingConversationId(conv.id);
                              setEditingConversationTitle(conv.titulo || "");
                              setChatTitle(conv.titulo || "");
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                            title="Renombrar"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatToDelete(conv);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Toggle Button (Chat Sidebar - solo desktop) ── */}
          <div
            className={`hidden md:flex relative items-start pt-3 z-10 transition-all duration-300 ${
              isChatSidebarOpen ? "-mx-3.5" : "ml-4 -mr-3.5"
            }`}
          >
            <button
              type="button"
              onClick={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-110 transition-all"
              title={isChatSidebarOpen ? "Ocultar historial" : "Mostrar historial"}
            >
              <ChevronLeft
                className={`h-4 w-4 transition-transform duration-300 ${
                  !isChatSidebarOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* ── Main Chat Area ── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Chat Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3.5 sm:px-5 py-2.5 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary/10 shadow-glow shrink-0">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="text-sm sm:text-base font-semibold tracking-tight truncate">
                      Chat IA del paciente
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
                      IA
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {chatId
                      ? chatConversations.find((c) => c.id === chatId)?.titulo || "Nueva conversación"
                      : "Analiza sesiones y documentos con IA"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsChatSidebarOpen(true)}
                  className="md:hidden inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs hover:bg-accent active:scale-95"
                  title="Ver conversaciones"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Historial</span>
                </button>
                {chatId && (
                  <button
                    type="button"
                    onClick={() => setShowChatControls(!showChatControls)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 sm:px-2.5 py-1 text-xs font-medium shadow-subtle transition-all hover:bg-accent shrink-0"
                  >
                    {showChatControls ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">Controles</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Controls */}
            {showChatControls && chatId && (
              <div className="flex items-center gap-3 border-b border-border/40 px-5 py-2.5 bg-muted/20 animate-fade-in-up">
                <label className="flex-1 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nombre de la conversación
                  </span>
                  <div className="flex gap-2">
                    <input
                      value={chatTitle}
                      onChange={(event) => setChatTitle(event.target.value)}
                      disabled={!chatId}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                      placeholder="Ej: Hipótesis inicial..."
                    />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={saveChatTitle}
                  disabled={!chatId || savingChatTitle}
                  className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-subtle transition-all hover:bg-accent disabled:opacity-50"
                >
                  {savingChatTitle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Guardar
                </button>
              </div>
            )}

            {chatError && (
              <div className="mx-5 mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                {chatError}
              </div>
            )}

            {/* Message Area */}
            <div ref={chatScrollContainerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
              {loadingChat ? (
                <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando conversación...
                </div>
              ) : !chatId ? (
                <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center px-4 py-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Crea una conversación para empezar</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    La IA analizará las sesiones y documentos de este paciente
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center px-4 py-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">
                    ¿En qué puedo ayudarte con {paciente.nombre_completo || `${paciente.nombre} ${paciente.apellido}`.trim()}?
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pregunta sobre patrones, temas recurrentes o cualquier aspecto clínico
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                {messages.map((message) => {
                  const isUser = message.rol === "USER";
                  const sources = deduplicateSources(message.fuentes_json || []);
                  const sourcesOpen = expandedSources.has(message.id);

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
                            {paciente.nombre.charAt(0).toUpperCase() || "P"}
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
                          <p className="whitespace-pre-wrap">{cleanMarkdownEmphasis(message.contenido)}</p>
                        </div>

                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => saveMessageAsInforme(message)}
                            disabled={savingInformeId === message.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                          >
                            {savingInformeId === message.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            Guardar como informe
                          </button>
                        )}

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
                })}
                </div>
              )}

              {/* Typing indicator */}
              {iaTyping && (
                <div className="mt-4 flex animate-fade-in-up items-start gap-3">
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

            {/* Suggested Prompts */}
            <div className="shrink-0 border-t border-border/40 px-3.5 py-2.5 sm:px-5 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preguntas sugeridas
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                {CHAT_SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => selectSuggestedChatPrompt(prompt)}
                    disabled={sendingChat || creatingChat}
                    className="w-fit max-w-full whitespace-normal rounded-full border border-border/80 bg-card px-3 py-1.5 text-left text-xs font-medium leading-snug text-foreground shadow-subtle transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input */}
            <div className="shrink-0 border-t border-border/40 px-3 py-2.5 sm:px-5 sm:py-3">
              {paciente.consentimiento_vigente === false && (
                <AvisoConsentimiento
                  pacienteId={paciente.id}
                  mensaje="Las preguntas se envían a la IA sin el nombre del paciente."
                  className="mb-2"
                />
              )}
              <form onSubmit={sendChatMessage} className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={sendingChat || creatingChat}
                  className="flex-1 min-w-0 resize-none rounded-xl border border-input bg-background px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                  placeholder={
                    chatId
                      ? `Pregunta sobre las sesiones de ${paciente.nombre_completo || `${paciente.nombre} ${paciente.apellido}`.trim()}...`
                      : "Crea una conversación para empezar"
                  }
                />
                <button
                  type="submit"
                  disabled={sendingChat || creatingChat || !chatInput.trim()}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sendingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!chatToDelete}
        title="Eliminar conversación IA"
        description={
          chatToDelete
            ? `Se eliminará permanentemente la conversación "${chatToDelete.titulo || "Nueva conversación"}" y todos sus mensajes.`
            : ""
        }
        confirmLabel="Eliminar conversación"
        confirming={deletingChat}
        error=""
        onCancel={() => {
          if (deletingChat) return;
          setChatToDelete(null);
        }}
        onConfirm={deleteChatConversation}
      />
    </>
  );
}
