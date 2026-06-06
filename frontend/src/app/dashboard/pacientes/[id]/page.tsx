"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ArrowLeft,
  ArrowUp,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Clock,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  rut: string;
  edad: number | null;
  sexo: string;
  ocupacion_laboral: string;
  motivo_consulta: string;
  telefono_whatsapp: string;
  email_contacto: string;
  nacionalidad: string;
  religion: string;
  direccion: string;
  comuna: string;
  prevision: string;
  es_menor_edad: boolean;
  nombre_tutor: string;
  telefono_tutor: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  origen_consulta: string;
  derivacion_interconsulta: string;
  diagnostico_sospechado: string;
  medicacion_actual: string;
  riesgo_suicida: boolean;
  ideacion_suicida_nivel: number | null;
  frecuencia_atencion: string;
  objetivos_intervencion: string;
  notas_privadas: string;
  activo: boolean;
  created_at: string;
}

interface Sesion {
  id: number;
  numero_sesion: number | null;
  fecha_hora_inicio: string;
  duracion_segundos: number | null;
  origen: "AUDIO" | "DOCUMENTO_EXTERNO" | "VIRTUAL" | "TEST_PSICOLOGICO";
  documento_nombre_original: string;
  estado: string;
}

interface SegmentoDocumento {
  id: number;
  orden: number;
  texto: string;
}

interface DocumentoExternoDetalle extends Sesion {
  segmentos: SegmentoDocumento[];
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

interface InformeIA {
  id: number;
  paciente: number;
  titulo: string;
  tipo: string;
  contenido: string;
  created_at: string;
}

const CHAT_SUGGESTED_PROMPTS = [
  "Elabora un informe clínico breve del proceso terapéutico de este paciente.",
  "Genera un resumen clínico con temas trabajados, indicadores relevantes y límites de la información disponible.",
  "Analiza el caso y sugiere objetivos pendientes para las próximas sesiones.",
  "Prepara la próxima sesión considerando avances, alertas o riesgos y focos de intervención.",
];

interface TestSendResult {
  id: number;
  public_url: string;
  email_enviado: boolean;
  email_error: string;
  email_configurado: boolean;
  fecha_expiracion: string;
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

function calcularEdad(fecha: string): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  const nac = new Date(fecha);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

function getSexoLabel(sexo: string) {
  const map: Record<string, string> = {
    M: "Masculino",
    F: "Femenino",
    O: "Otro",
    N: "No especifica",
  };
  return map[sexo] || sexo;
}

function formatDateInputValue(dateStr: string | null) {
  if (!dateStr) return "";
  return dateStr.split("T")[0];
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

function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function getInformeTipoLabel(tipo: string) {
  const map: Record<string, string> = {
    RESUMEN_CLINICO: "Resumen clínico",
    EVOLUCION: "Evolución",
    PROXIMA_SESION: "Próxima sesión",
    OTRO: "Otro",
  };
  return map[tipo] || tipo;
}

function safeFilename(value: string) {
  return (value || "informe-ia")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "informe-ia";
}

function cleanMarkdownEmphasis(text: string) {
  return (text || "")
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => value.trim().toUpperCase())
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

// ------------ CHAT IA + PAGE ------------

export default function PacienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [informes, setInformes] = useState<InformeIA[]>([]);
  const [savingInformeId, setSavingInformeId] = useState<number | null>(null);
  const [selectedInforme, setSelectedInforme] = useState<InformeIA | null>(null);
  const [informeToDelete, setInformeToDelete] = useState<InformeIA | null>(null);
  const [deletingInformeId, setDeletingInformeId] = useState<number | null>(null);
  const [downloadingInforme, setDownloadingInforme] = useState<string | null>(null);
  const [informeSuccess, setInformeSuccess] = useState("");

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
  const [chatToDelete, setChatToDelete] = useState<ChatConversacion | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  // Virtual session modal
  const [virtualModalOpen, setVirtualModalOpen] = useState(false);
  const [virtualStep, setVirtualStep] = useState<1 | 2>(1);
  const [virtualPlatform, setVirtualPlatform] = useState<"GOOGLE_MEET" | "ZOOM">("GOOGLE_MEET");
  const [virtualUrl, setVirtualUrl] = useState("");
  const [virtualDateTime, setVirtualDateTime] = useState(getDateTimeInputValue());
  const [virtualSesionId, setVirtualSesionId] = useState<number | null>(null);
  const [virtualSpeakers, setVirtualSpeakers] = useState<string[]>([]);
  const [virtualPsicologo, setVirtualPsicologo] = useState("");
  const [virtualPaciente, setVirtualPaciente] = useState("");
  const [creatingVirtual, setCreatingVirtual] = useState(false);
  const [finalizingVirtual, setFinalizingVirtual] = useState(false);
  const [virtualError, setVirtualError] = useState("");

  // Document modal
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentDateTime, setDocumentDateTime] = useState(getDateTimeInputValue());
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentoExternoDetalle | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<number | null>(null);
  const [downloadingDocument, setDownloadingDocument] = useState<string | null>(null);

  // Psychological test modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSendError, setTestSendError] = useState("");
  const [testSendResult, setTestSendResult] = useState<TestSendResult | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Delete session confirmation
  const [sessionToDelete, setSessionToDelete] = useState<Sesion | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [deleteSessionError, setDeleteSessionError] = useState("");

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editFechaNacimiento, setEditFechaNacimiento] = useState("");
  const [editRut, setEditRut] = useState("");
  const [editEdad, setEditEdad] = useState("");
  const [editSexo, setEditSexo] = useState("N");
  const [editOcupacion, setEditOcupacion] = useState("");
  const [editMotivo, setEditMotivo] = useState("");
  const [editTelefonoWhatsapp, setEditTelefonoWhatsapp] = useState("");
  const [editEmailContacto, setEditEmailContacto] = useState("");
  const [editNacionalidad, setEditNacionalidad] = useState("");
  const [editReligion, setEditReligion] = useState("");
  const [editDireccion, setEditDireccion] = useState("");
  const [editComuna, setEditComuna] = useState("");
  const [editPrevision, setEditPrevision] = useState("");
  const [editEsMenorEdad, setEditEsMenorEdad] = useState(false);
  const [editNombreTutor, setEditNombreTutor] = useState("");
  const [editTelefonoTutor, setEditTelefonoTutor] = useState("");
  const [editContactoEmergenciaNombre, setEditContactoEmergenciaNombre] = useState("");
  const [editContactoEmergenciaTelefono, setEditContactoEmergenciaTelefono] = useState("");
  const [editOrigenConsulta, setEditOrigenConsulta] = useState("");
  const [editDerivacionInterconsulta, setEditDerivacionInterconsulta] = useState("");
  const [editDiagnosticoSospechado, setEditDiagnosticoSospechado] = useState("");
  const [editMedicacionActual, setEditMedicacionActual] = useState("");
  const [editRiesgoSuicida, setEditRiesgoSuicida] = useState(false);
  const [editIdeacionSuicidaNivel, setEditIdeacionSuicidaNivel] = useState("");
  const [editFrecuenciaAtencion, setEditFrecuenciaAtencion] = useState("");
  const [editObjetivosIntervencion, setEditObjetivosIntervencion] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const calc = calcularEdad(editFechaNacimiento);
    if (calc !== null) setEditEdad(calc.toString());
  }, [editFechaNacimiento]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, iaTyping]);

  async function loadData() {
    try {
      const [pacRes, sesRes, informesRes] = await Promise.all([
        apiFetch(`/pacientes/${id}/`),
        apiFetch(`/sesiones/?paciente=${id}`),
        apiFetch(`/chat/informes/?paciente=${id}`),
      ]);
      const pacData = await pacRes.json();
      const sesData = await sesRes.json();
      const informesData = await informesRes.json();
      setPaciente(pacData);
      setSesiones(sesData.results || sesData);
      setInformes(informesData.results || informesData);
      await loadChatConversations();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadInformes() {
    try {
      const res = await apiFetch(`/chat/informes/?paciente=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setInformes(data.results || data);
    } catch (err) {
      console.error(err);
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

  async function saveMessageAsInforme(message: ChatMensaje) {
    setSavingInformeId(message.id);
    setChatError("");
    setInformeSuccess("");
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
      await loadInformes();
      setInformeSuccess("Informe IA guardado correctamente.");
      setTimeout(() => setInformeSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setChatError("No se pudo guardar la respuesta como informe.");
    } finally {
      setSavingInformeId(null);
    }
  }

  async function downloadInforme(informe: InformeIA, format: "pdf" | "docx") {
    const key = `${informe.id}-${format}`;
    setDownloadingInforme(key);
    setChatError("");
    try {
      const endpoint = format === "pdf" ? "exportar_pdf" : "exportar_docx";
      const res = await apiFetch(`/chat/informes/${informe.id}/${endpoint}/`);
      if (!res.ok) {
        setChatError(`No se pudo descargar el informe en ${format.toUpperCase()}.`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFilename(informe.titulo || getInformeTipoLabel(informe.tipo))}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setChatError(`No se pudo descargar el informe en ${format.toUpperCase()}.`);
    } finally {
      setDownloadingInforme(null);
    }
  }

  async function deleteInforme() {
    if (!informeToDelete) return;
    setDeletingInformeId(informeToDelete.id);
    setChatError("");
    try {
      const res = await apiFetch(`/chat/informes/${informeToDelete.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setChatError("No se pudo eliminar el informe IA.");
        return;
      }
      setInformes((prev) => prev.filter((informe) => informe.id !== informeToDelete.id));
      if (selectedInforme?.id === informeToDelete.id) setSelectedInforme(null);
      setInformeToDelete(null);
      setInformeSuccess("Informe IA eliminado correctamente.");
      setTimeout(() => setInformeSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setChatError("No se pudo eliminar el informe IA.");
    } finally {
      setDeletingInformeId(null);
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

  // ---------- Virtual sessions ----------

  function openVirtualModal() {
    setVirtualStep(1);
    setVirtualPlatform("GOOGLE_MEET");
    setVirtualUrl("");
    setVirtualDateTime(getDateTimeInputValue());
    setVirtualSesionId(null);
    setVirtualSpeakers([]);
    setVirtualPsicologo("");
    setVirtualPaciente("");
    setVirtualError("");
    setVirtualModalOpen(true);
  }

  async function handleCreateVirtual(e: React.FormEvent) {
    e.preventDefault();
    setVirtualError("");
    setCreatingVirtual(true);
    try {
      const res = await apiFetch("/sesiones/crear_virtual/", {
        method: "POST",
        body: JSON.stringify({
          paciente: parseInt(id),
          plataforma: virtualPlatform,
          url_reunion: virtualUrl || undefined,
          fecha_hora_inicio: new Date(virtualDateTime).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setVirtualError(getApiErrorMessage(data, "No se pudo crear la sesión remota."));
        return;
      }
      const sesion = await res.json();
      setVirtualSesionId(sesion.id);
      sessionStorage.setItem("virtual_session_id", String(sesion.id));
      sessionStorage.setItem("virtual_session_paciente", paciente?.nombre_completo || "");
      setVirtualStep(2);
      await loadData();
    } catch {
      setVirtualError("No se pudo crear la sesión remota.");
    } finally {
      setCreatingVirtual(false);
    }
  }

  async function pollVirtualSpeakers(sesId: number) {
    try {
      const res = await apiFetch(`/sesiones/${sesId}/caption_count/`);
      const data = await res.json();
      if (data.speakers?.length) setVirtualSpeakers(data.speakers);
    } catch {}
  }

  async function handleFinalizeVirtual(e: React.FormEvent) {
    e.preventDefault();
    if (!virtualSesionId) return;
    setVirtualError("");
    setFinalizingVirtual(true);
    try {
      const res = await apiFetch(`/sesiones/${virtualSesionId}/finalizar_virtual/`, {
        method: "POST",
        body: JSON.stringify({
          nombre_psicologo: virtualPsicologo.trim(),
          nombre_paciente: virtualPaciente.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setVirtualError(getApiErrorMessage(data, "No se pudo finalizar la sesión remota."));
        return;
      }
      sessionStorage.removeItem("virtual_session_id");
      sessionStorage.removeItem("virtual_session_paciente");
      setVirtualModalOpen(false);
      await loadData();
      const sesion = await res.json();
      router.push(`/dashboard/pacientes/${id}/sesiones/${sesion.id}`);
    } catch {
      setVirtualError("No se pudo finalizar la sesión remota.");
    } finally {
      setFinalizingVirtual(false);
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

  function openTestModal() {
    setTestSendError("");
    setTestSendResult(null);
    setCopySuccess(false);
    setTestModalOpen(true);
  }

  async function handleSendEllisTest() {
    if (!paciente) return;
    setTestSendError("");
    setTestSendResult(null);
    setCopySuccess(false);
    if (!paciente.email_contacto) {
      setTestSendError("El paciente no tiene correo registrado. Edita la ficha antes de enviar el test.");
      return;
    }
    setSendingTest(true);
    try {
      const res = await apiFetch("/evaluaciones/asignaciones/", {
        method: "POST",
        body: JSON.stringify({ paciente: paciente.id, test_slug: "creencias-ellis" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestSendError(getApiErrorMessage(data, "No se pudo generar el test."));
        return;
      }
      setTestSendResult(data);
    } catch (err) {
      console.error(err);
      setTestSendError("No se pudo generar el test.");
    } finally {
      setSendingTest(false);
    }
  }

  async function copyGeneratedTestLink() {
    if (!testSendResult?.public_url) return;
    try {
      await navigator.clipboard.writeText(testSendResult.public_url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      setTestSendError("No se pudo copiar el enlace automáticamente.");
    }
  }

  async function handleDeleteSession() {
    if (!sessionToDelete) return;
    const isExternalDocument = sessionToDelete.origen === "DOCUMENTO_EXTERNO";
    const isTestSession = sessionToDelete.origen === "TEST_PSICOLOGICO";
    const targetLabel = isExternalDocument ? "el documento" : isTestSession ? "el test" : "la sesión";
    setDeletingSessionId(sessionToDelete.id);
    setDeleteSessionError("");
    try {
      const res = await apiFetch(`/sesiones/${sessionToDelete.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteSessionError(`No se pudo eliminar ${targetLabel}. Inténtalo nuevamente.`);
        return;
      }
      setSesiones((prev) => prev.filter((sesion) => sesion.id !== sessionToDelete.id));
      if (selectedDocument?.id === sessionToDelete.id) setSelectedDocument(null);
      setSessionToDelete(null);
    } catch (err) {
      console.error(err);
      setDeleteSessionError(`No se pudo eliminar ${targetLabel}. Inténtalo nuevamente.`);
    } finally {
      setDeletingSessionId(null);
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

  async function openExternalDocument(documento: Sesion) {
    setOpeningDocumentId(documento.id);
    setDocumentError("");
    try {
      const res = await apiFetch(`/sesiones/${documento.id}/`);
      if (!res.ok) {
        setDocumentError("No se pudo abrir el documento externo.");
        return;
      }
      const data = await res.json();
      setSelectedDocument(data);
    } catch (err) {
      console.error(err);
      setDocumentError("No se pudo abrir el documento externo.");
    } finally {
      setOpeningDocumentId(null);
    }
  }

  async function downloadExternalDocument(documento: Sesion, format: "pdf" | "docx") {
    const key = `${documento.id}-${format}`;
    setDownloadingDocument(key);
    setDocumentError("");
    try {
      const endpoint = format === "pdf" ? "exportar_pdf" : "exportar_docx";
      const res = await apiFetch(`/sesiones/${documento.id}/${endpoint}/`);
      if (!res.ok) {
        setDocumentError(`No se pudo descargar el documento en ${format.toUpperCase()}.`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = documento.documento_nombre_original || `documento-${documento.id}`;
      a.download = `${safeFilename(base.replace(/\.[^.]+$/, ""))}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setDocumentError(`No se pudo descargar el documento en ${format.toUpperCase()}.`);
    } finally {
      setDownloadingDocument(null);
    }
  }

  function openEditModal() {
    if (!paciente) return;
    setEditNombre(paciente.nombre);
    setEditApellido(paciente.apellido);
    setEditFechaNacimiento(formatDateInputValue(paciente.fecha_nacimiento));
    setEditRut(paciente.rut || "");
    setEditEdad(paciente.edad?.toString() || "");
    setEditSexo(paciente.sexo || "N");
    setEditOcupacion(paciente.ocupacion_laboral || "");
    setEditMotivo(paciente.motivo_consulta || "");
    setEditTelefonoWhatsapp(paciente.telefono_whatsapp || "");
    setEditEmailContacto(paciente.email_contacto || "");
    setEditNacionalidad(paciente.nacionalidad || "");
    setEditReligion(paciente.religion || "");
    setEditDireccion(paciente.direccion || "");
    setEditComuna(paciente.comuna || "");
    setEditPrevision(paciente.prevision || "");
    setEditEsMenorEdad(Boolean(paciente.es_menor_edad));
    setEditNombreTutor(paciente.nombre_tutor || "");
    setEditTelefonoTutor(paciente.telefono_tutor || "");
    setEditContactoEmergenciaNombre(paciente.contacto_emergencia_nombre || "");
    setEditContactoEmergenciaTelefono(paciente.contacto_emergencia_telefono || "");
    setEditOrigenConsulta(paciente.origen_consulta || "");
    setEditDerivacionInterconsulta(paciente.derivacion_interconsulta || "");
    setEditDiagnosticoSospechado(paciente.diagnostico_sospechado || "");
    setEditMedicacionActual(paciente.medicacion_actual || "");
    setEditRiesgoSuicida(Boolean(paciente.riesgo_suicida));
    setEditIdeacionSuicidaNivel(paciente.ideacion_suicida_nivel?.toString() || "");
    setEditFrecuenciaAtencion(paciente.frecuencia_atencion || "");
    setEditObjetivosIntervencion(paciente.objetivos_intervencion || "");
    setEditNotas(paciente.notas_privadas || "");
    setEditError("");
    setEditModalOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setSavingEdit(true);
    try {
      const res = await apiFetch(`/pacientes/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: editNombre,
          apellido: editApellido,
          fecha_nacimiento: editFechaNacimiento || null,
          rut: editRut,
          edad: editEdad ? parseInt(editEdad) : null,
          sexo: editSexo,
          ocupacion_laboral: editOcupacion,
          motivo_consulta: editMotivo,
          telefono_whatsapp: editTelefonoWhatsapp,
          email_contacto: editEmailContacto,
          nacionalidad: editNacionalidad,
          religion: editReligion,
          direccion: editDireccion,
          comuna: editComuna,
          prevision: editPrevision,
          es_menor_edad: editEsMenorEdad,
          nombre_tutor: editNombreTutor,
          telefono_tutor: editTelefonoTutor,
          contacto_emergencia_nombre: editContactoEmergenciaNombre,
          contacto_emergencia_telefono: editContactoEmergenciaTelefono,
          origen_consulta: editOrigenConsulta,
          derivacion_interconsulta: editDerivacionInterconsulta,
          diagnostico_sospechado: editDiagnosticoSospechado,
          medicacion_actual: editMedicacionActual,
          riesgo_suicida: editRiesgoSuicida,
          ideacion_suicida_nivel: editIdeacionSuicidaNivel ? parseInt(editIdeacionSuicidaNivel) : null,
          frecuencia_atencion: editFrecuenciaAtencion,
          objetivos_intervencion: editObjetivosIntervencion,
          notas_privadas: editNotas,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPaciente(updated);
      setEditModalOpen(false);
    } catch {
      setEditError("No se pudieron guardar los cambios.");
    } finally {
      setSavingEdit(false);
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

  const hasContactData = Boolean(
    paciente.telefono_whatsapp ||
      paciente.email_contacto ||
      paciente.direccion ||
      paciente.comuna ||
      paciente.nacionalidad ||
      paciente.religion ||
      paciente.prevision
  );
  const hasClinicalData = Boolean(
    paciente.diagnostico_sospechado ||
      paciente.medicacion_actual ||
      paciente.frecuencia_atencion ||
      paciente.derivacion_interconsulta ||
      paciente.origen_consulta
  );
  const hasRiskData = Boolean(
    paciente.riesgo_suicida ||
      paciente.ideacion_suicida_nivel ||
      paciente.contacto_emergencia_nombre ||
      paciente.contacto_emergencia_telefono ||
      paciente.es_menor_edad ||
      paciente.nombre_tutor ||
      paciente.telefono_tutor
  );
  const documentosExternos = sesiones.filter(
    (sesion) => sesion.origen === "DOCUMENTO_EXTERNO"
  );
  const sesionesClinicas = sesiones.filter(
    (sesion) => sesion.origen !== "DOCUMENTO_EXTERNO"
  );
  const deleteTargetIsDocument = sessionToDelete?.origen === "DOCUMENTO_EXTERNO";
  const deleteTargetIsTest = sessionToDelete?.origen === "TEST_PSICOLOGICO";
  const deleteTargetLabel = deleteTargetIsDocument ? "documento externo" : deleteTargetIsTest ? "test psicológico" : "sesión";

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
      <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
        <div className="flex items-start gap-5 p-6">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary shadow-sm">
            {paciente.nombre.charAt(0).toUpperCase()}
            {paciente.apellido.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {paciente.nombre_completo}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {paciente.rut && <span>{paciente.rut}</span>}
                  {paciente.rut && (paciente.edad || paciente.sexo !== "N") && <span className="mx-2">·</span>}
                  {paciente.edad && <span>{paciente.edad} años</span>}
                  {(paciente.edad || paciente.rut) && paciente.sexo && paciente.sexo !== "N" && <span className="mx-2">·</span>}
                  {paciente.sexo && paciente.sexo !== "N" && <span>{getSexoLabel(paciente.sexo)}</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={openTestModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 shadow-subtle transition-all hover:bg-emerald-100 hover:shadow-card dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  <Send className="h-4 w-4" />
                  Enviar test
                </button>
                <button
                  onClick={openEditModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-subtle transition-all hover:bg-accent hover:shadow-card"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-border/60 px-6 py-4">
          <div className="grid grid-cols-2 gap-y-5 gap-x-8 sm:grid-cols-4">
            {paciente.rut && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">RUT</p>
                <p className="mt-1 text-sm font-medium">{paciente.rut}</p>
              </div>
            )}
            {paciente.edad && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Edad</p>
                <p className="mt-1 text-sm font-medium">{paciente.edad} años</p>
              </div>
            )}
            {paciente.sexo && paciente.sexo !== "N" && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sexo</p>
                <p className="mt-1 text-sm font-medium">{getSexoLabel(paciente.sexo)}</p>
              </div>
            )}
            {paciente.fecha_nacimiento && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha de nacimiento</p>
                <p className="mt-1 text-sm font-medium">{formatDate(paciente.fecha_nacimiento)}</p>
              </div>
            )}
            {paciente.ocupacion_laboral && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ocupación</p>
                <p className="mt-1 text-sm font-medium">{paciente.ocupacion_laboral}</p>
              </div>
            )}
          </div>
        </div>
        {paciente.motivo_consulta && (
          <div className="border-t border-border/60 bg-muted/30 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Motivo de consulta
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{paciente.motivo_consulta}</p>
          </div>
        )}
        {paciente.objetivos_intervencion && (
          <div className="border-t border-border/60 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Objetivos de intervención
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
              {paciente.objetivos_intervencion}
            </p>
          </div>
        )}
        {hasContactData && (
          <div className="border-t border-border/60 px-6 py-4">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contacto y datos administrativos
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="WhatsApp" value={paciente.telefono_whatsapp} />
              <DetailItem label="Correo" value={paciente.email_contacto} />
              <DetailItem label="Dirección" value={paciente.direccion} />
              <DetailItem label="Comuna" value={paciente.comuna} />
              <DetailItem label="Nacionalidad" value={paciente.nacionalidad} />
              <DetailItem label="Religión" value={paciente.religion} />
              <DetailItem label="Previsión" value={paciente.prevision} />
            </div>
          </div>
        )}
        {hasClinicalData && (
          <div className="border-t border-border/60 bg-muted/30 px-6 py-4">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Información clínica ampliada
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Frecuencia" value={paciente.frecuencia_atencion} />
              <DetailItem label="Origen" value={paciente.origen_consulta} />
              <DetailItem label="Diagnóstico sospechado" value={paciente.diagnostico_sospechado} />
              <DetailItem label="Medicación actual" value={paciente.medicacion_actual} />
              <DetailItem label="Derivación/interconsulta" value={paciente.derivacion_interconsulta} />
            </div>
          </div>
        )}
        {hasRiskData && (
          <div className="border-t border-amber-200 bg-amber-50/60 px-6 py-4 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Riesgo, emergencia y responsable
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Riesgo suicida" value={paciente.riesgo_suicida ? "Sí" : ""} />
              <DetailItem label="Ideación suicida" value={paciente.ideacion_suicida_nivel} />
              <DetailItem label="Contacto emergencia" value={paciente.contacto_emergencia_nombre} />
              <DetailItem label="Tel. emergencia" value={paciente.contacto_emergencia_telefono} />
              <DetailItem label="Menor de edad" value={paciente.es_menor_edad ? "Sí" : ""} />
              <DetailItem label="Tutor" value={paciente.nombre_tutor} />
              <DetailItem label="Tel. tutor" value={paciente.telefono_tutor} />
            </div>
          </div>
        )}
      </div>

      {/* Send test modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-border/60 bg-card p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                  Enviar Test de Creencias Ellis
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se generará un enlace personal para {paciente.nombre_completo} con vencimiento de 7 días y uso único.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">Correo destino</p>
                <p className="mt-1 text-muted-foreground">
                  {paciente.email_contacto || "Sin correo registrado"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">Mensaje estándar</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  Hola {paciente.nombre}, tu psicólogo/a te solicita completar el Test de Creencias Ellis como parte de tu proceso. El enlace es personal, vence en 7 días y no requiere iniciar sesión.
                </p>
              </div>
              {!paciente.email_contacto && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  Para enviar el test debes registrar un correo de contacto en la ficha del paciente.
                </div>
              )}
              {testSendResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <p className="font-semibold">
                    {testSendResult.email_enviado
                      ? "Correo enviado correctamente."
                      : "Enlace generado. El correo queda pendiente hasta configurar SMTP."}
                  </p>
                  {testSendResult.email_error && (
                    <p className="mt-1 text-xs">{testSendResult.email_error}</p>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={testSendResult.public_url}
                      className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-background dark:text-emerald-200"
                    />
                    <button
                      type="button"
                      onClick={copyGeneratedTestLink}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      <Copy className="h-4 w-4" />
                      {copySuccess ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}
              {testSendError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {testSendError}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSendEllisTest}
                disabled={sendingTest || !paciente.email_contacto}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-subtle transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {sendingTest && <Loader2 className="h-4 w-4 animate-spin" />}
                {sendingTest ? "Generando..." : "Generar y enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleEdit}
            className="w-full max-w-3xl rounded-xl border border-border/60 bg-card p-6 shadow-elevated max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Editar datos del paciente</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Actualiza la información básica del paciente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Nombre</span>
                  <input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Apellido</span>
                  <input
                    value={editApellido}
                    onChange={(e) => setEditApellido(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">RUT</span>
                  <input
                    value={editRut}
                    onChange={(e) => setEditRut(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    placeholder="Ej: 12.345.678-9"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Edad</span>
                  <input
                    type="number"
                    value={editEdad}
                    readOnly
                    className="w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground"
                    min={0}
                    max={150}
                  />
                  <span className="block text-xs text-muted-foreground">Se calcula desde la fecha de nacimiento</span>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Fecha de nacimiento</span>
                  <input
                    type="date"
                    value={editFechaNacimiento}
                    onChange={(e) => setEditFechaNacimiento(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Sexo</span>
                  <select
                    value={editSexo}
                    onChange={(e) => setEditSexo(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                  >
                    <option value="N">No especifica</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium">Ocupación laboral</span>
                <input
                  value={editOcupacion}
                  onChange={(e) => setEditOcupacion(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                  placeholder="Ej: Ingeniero, Docente, Estudiante..."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Motivo de consulta</span>
                <input
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                />
              </label>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Objetivos y proceso terapéutico
                </p>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Objetivos de intervención</span>
                  <textarea
                    value={editObjetivosIntervencion}
                    onChange={(e) => setEditObjetivosIntervencion(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-y"
                    rows={4}
                    placeholder="Objetivos iniciales, focos de trabajo y metas del proceso..."
                  />
                </label>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contacto y datos administrativos
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">WhatsApp</span>
                    <input
                      value={editTelefonoWhatsapp}
                      onChange={(e) => setEditTelefonoWhatsapp(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Correo de contacto</span>
                    <input
                      type="email"
                      value={editEmailContacto}
                      onChange={(e) => setEditEmailContacto(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Nacionalidad</span>
                    <input
                      value={editNacionalidad}
                      onChange={(e) => setEditNacionalidad(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Religión</span>
                    <input
                      value={editReligion}
                      onChange={(e) => setEditReligion(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Dirección</span>
                    <input
                      value={editDireccion}
                      onChange={(e) => setEditDireccion(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Comuna</span>
                    <input
                      value={editComuna}
                      onChange={(e) => setEditComuna(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Previsión</span>
                    <input
                      value={editPrevision}
                      onChange={(e) => setEditPrevision(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Origen de consulta</span>
                    <input
                      value={editOrigenConsulta}
                      onChange={(e) => setEditOrigenConsulta(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                      placeholder="Instagram, referido, CAF, boca a boca..."
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Información clínica ampliada
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Frecuencia de atención</span>
                    <input
                      value={editFrecuenciaAtencion}
                      onChange={(e) => setEditFrecuenciaAtencion(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                      placeholder="Semanal, quincenal, mensual, seguimiento..."
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Diagnóstico sospechado</span>
                    <input
                      value={editDiagnosticoSospechado}
                      onChange={(e) => setEditDiagnosticoSospechado(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                </div>
                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-medium">Medicación actual</span>
                  <textarea
                    value={editMedicacionActual}
                    onChange={(e) => setEditMedicacionActual(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-y"
                    rows={2}
                  />
                </label>
                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-medium">Derivación o interconsulta</span>
                  <textarea
                    value={editDerivacionInterconsulta}
                    onChange={(e) => setEditDerivacionInterconsulta(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-y"
                    rows={2}
                  />
                </label>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Riesgo, emergencia y responsable
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={editRiesgoSuicida}
                      onChange={(e) => setEditRiesgoSuicida(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Riesgo suicida activo o relevante
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={editEsMenorEdad}
                      onChange={(e) => setEditEsMenorEdad(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Menor de edad
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Nivel ideación suicida</span>
                    <input
                      type="number"
                      value={editIdeacionSuicidaNivel}
                      onChange={(e) => setEditIdeacionSuicidaNivel(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                      min={1}
                      max={5}
                      placeholder="1 a 5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Contacto emergencia</span>
                    <input
                      value={editContactoEmergenciaNombre}
                      onChange={(e) => setEditContactoEmergenciaNombre(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tel. emergencia</span>
                    <input
                      value={editContactoEmergenciaTelefono}
                      onChange={(e) => setEditContactoEmergenciaTelefono(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tutor/responsable</span>
                    <input
                      value={editNombreTutor}
                      onChange={(e) => setEditNombreTutor(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tel. tutor</span>
                    <input
                      value={editTelefonoTutor}
                      onChange={(e) => setEditTelefonoTutor(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </label>
                </div>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium">Notas privadas</span>
                <textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-y"
                  rows={3}
                />
              </label>
            </div>
            {editError && (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {editError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* External documents */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Documentos externos
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Archivos cargados como contexto del paciente, separados de las sesiones clínicas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              {documentosExternos.length} documento{documentosExternos.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={openDocumentModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-subtle transition-all hover:bg-accent hover:shadow-card"
            >
              <Upload className="h-4 w-4" />
              Cargar documento
            </button>
          </div>
        </div>
        {documentError && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {documentError}
          </div>
        )}
        {documentosExternos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aún no hay documentos externos cargados para este paciente.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {documentosExternos.map((documento) => (
              <div key={documento.id} className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {documento.documento_nombre_original || `Documento ${documento.id}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(documento.fecha_hora_inicio)} · {getStatusLabel(documento.estado)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openExternalDocument(documento)}
                      disabled={openingDocumentId === documento.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {openingDocumentId === documento.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadExternalDocument(documento, "pdf")}
                      disabled={downloadingDocument === `${documento.id}-pdf`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {downloadingDocument === `${documento.id}-pdf` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadExternalDocument(documento, "docx")}
                      disabled={downloadingDocument === `${documento.id}-docx`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {downloadingDocument === `${documento.id}-docx` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionToDelete(documento)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border/60 bg-card shadow-elevated">
            <div className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Documento externo
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {selectedDocument.documento_nombre_original || `Documento ${selectedDocument.id}`}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cargado el {formatDate(selectedDocument.fecha_hora_inicio)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocument(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {selectedDocument.segmentos?.length ? (
                <div className="space-y-5">
                  {selectedDocument.segmentos.map((segmento) => (
                    <div key={segmento.id}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Parte {segmento.orden}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {segmento.texto}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Documento sin contenido extraído.</p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 p-5">
              <button
                type="button"
                onClick={() => downloadExternalDocument(selectedDocument, "pdf")}
                disabled={downloadingDocument === `${selectedDocument.id}-pdf`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {downloadingDocument === `${selectedDocument.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={() => downloadExternalDocument(selectedDocument, "docx")}
                disabled={downloadingDocument === `${selectedDocument.id}-docx`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {downloadingDocument === `${selectedDocument.id}-docx` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar Word
              </button>
              <button
                type="button"
                onClick={() => setSessionToDelete(selectedDocument)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Sesiones ({sesionesClinicas.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={openVirtualModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-700 shadow-subtle transition-all hover:bg-sky-100 hover:shadow-card dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50"
          >
            <Video className="h-4 w-4" />
            Sesión remota
          </button>
          <button
            onClick={handleNewSession}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card"
          >
            <Play className="h-4 w-4" />
            Sesión presencial
          </button>
        </div>
      </div>

      {/* Virtual session modal */}
      {virtualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Video className="h-5 w-5 text-sky-500" />
                  {virtualStep === 1 ? "Nueva sesión remota" : "Finalizar sesión remota"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {virtualStep === 1
                    ? "Crea la sesión y luego conecta la extensión Chrome durante la reunión."
                    : "Indica qué nombre usaste en Meet/Zoom para asignar los hablantes."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVirtualModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {virtualStep === 1 ? (
              <form onSubmit={handleCreateVirtual} className="mt-5 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Plataforma</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["GOOGLE_MEET", "ZOOM"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setVirtualPlatform(p)}
                        className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                          virtualPlatform === p
                            ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                            : "border-border bg-card hover:bg-accent"
                        }`}
                      >
                        {p === "GOOGLE_MEET" ? "Google Meet" : "Zoom"}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">URL de la reunión <span className="text-muted-foreground font-normal">(opcional)</span></span>
                  <input
                    type="url"
                    value={virtualUrl}
                    onChange={(e) => setVirtualUrl(e.target.value)}
                    placeholder={virtualPlatform === "GOOGLE_MEET" ? "https://meet.google.com/abc-defg-hij" : "https://zoom.us/j/123456789"}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={virtualDateTime}
                    onChange={(e) => setVirtualDateTime(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                  <strong>Cómo funciona:</strong> Instala la extensión Chrome de DatnexiA, inicia la reunión y la extensión capturará los subtítulos automáticamente. Al terminar, vuelve aquí para finalizar la sesión.
                </div>
                {virtualError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{virtualError}</div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setVirtualModalOpen(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creatingVirtual} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-subtle transition-all hover:bg-sky-700 disabled:opacity-50">
                    {creatingVirtual && <Loader2 className="h-4 w-4 animate-spin" />}
                    {creatingVirtual ? "Creando..." : "Crear sesión remota"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleFinalizeVirtual} className="mt-5 space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <strong>Sesión remota creada.</strong> Conecta la extensión Chrome durante la reunión. Cuando termines, vuelve aquí y completa los campos para asignar hablantes.
                </div>
                {virtualSpeakers.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">Hablantes detectados: </span>
                    {virtualSpeakers.join(", ")}
                  </div>
                )}
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Tu nombre en {virtualPlatform === "GOOGLE_MEET" ? "Google Meet" : "Zoom"} <span className="text-muted-foreground">(psicólogo)</span></span>
                  <input
                    value={virtualPsicologo}
                    onChange={(e) => setVirtualPsicologo(e.target.value)}
                    placeholder="Ej: Paulo Valenzuela"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Nombre del paciente en la llamada</span>
                  <input
                    value={virtualPaciente}
                    onChange={(e) => setVirtualPaciente(e.target.value)}
                    placeholder={`Ej: ${paciente?.nombre || "Matias"} ${paciente?.apellido || ""}`}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    required
                  />
                </label>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => virtualSesionId && pollVirtualSpeakers(virtualSesionId)}
                    className="text-sm text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Actualizar hablantes detectados
                  </button>
                </div>
                {virtualError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{virtualError}</div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setVirtualModalOpen(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent">
                    Cerrar
                  </button>
                  <button type="submit" disabled={finalizingVirtual} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50">
                    {finalizingVirtual && <Loader2 className="h-4 w-4 animate-spin" />}
                    {finalizingVirtual ? "Finalizando..." : "Finalizar sesión"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
                  Se guardará como documento externo, separado de las sesiones clínicas.
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

      <ConfirmDialog
        open={!!sessionToDelete}
        title={`Eliminar ${deleteTargetLabel}`}
        description={
          sessionToDelete
            ? deleteTargetIsDocument
              ? `Esta acción eliminará permanentemente el documento ${sessionToDelete.documento_nombre_original || `externo del ${formatDate(sessionToDelete.fecha_hora_inicio)}`}. No se puede deshacer.`
              : deleteTargetIsTest
                ? `Esta acción eliminará permanentemente el resultado del test ${sessionToDelete.documento_nombre_original || "psicológico"}. No se puede deshacer.`
              : `Esta acción eliminará permanentemente la sesión del ${formatDate(sessionToDelete.fecha_hora_inicio)} a las ${formatTime(sessionToDelete.fecha_hora_inicio)}. No se puede deshacer.`
            : ""
        }
        confirmLabel={`Eliminar ${deleteTargetLabel}`}
        confirming={deletingSessionId === sessionToDelete?.id}
        error={deleteSessionError}
        onCancel={() => {
          if (deletingSessionId) return;
          setSessionToDelete(null);
          setDeleteSessionError("");
        }}
        onConfirm={handleDeleteSession}
      />

      {/* Sessions list */}
      {sesionesClinicas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center shadow-subtle">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Sin sesiones clínicas registradas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Presiona &ldquo;Sesión presencial&rdquo; o crea una sesión remota
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sesionesClinicas.map((sesion) => {
            const isExternalDocument = sesion.origen === "DOCUMENTO_EXTERNO";
            const isRemote = sesion.origen === "VIRTUAL";
            const isTest = sesion.origen === "TEST_PSICOLOGICO";
            const sessionTitle = isExternalDocument
              ? "Documento externo"
              : isTest
                ? sesion.documento_nombre_original || "Test psicológico"
              : sesion.numero_sesion
                ? `Sesión ${sesion.numero_sesion}`
                : "Sesión";
            return (
              <div
                key={sesion.id}
                className="group flex items-center rounded-xl border border-border/60 bg-card text-left shadow-subtle transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/dashboard/pacientes/${id}/sesiones/${sesion.id}`)
                  }
                  className="flex min-w-0 flex-1 items-center gap-4 p-4 text-left"
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                      isExternalDocument
                        ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
                        : isTest
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : isRemote
                          ? "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isExternalDocument ? (
                      <FileText className="h-5 w-5" />
                    ) : isTest ? (
                      <ClipboardList className="h-5 w-5" />
                    ) : isRemote ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <Calendar className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{sessionTitle}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(sesion.fecha_hora_inicio)}</span>
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
                      {isTest && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <ClipboardList className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">Resultado de test</span>
                        </span>
                      )}
                      {!isExternalDocument && sesion.duracion_segundos
                        ? formatDuration(sesion.duracion_segundos)
                        : null}
                    </div>
                  </div>
                </button>
                <div className="flex flex-shrink-0 flex-col items-end gap-2 py-4 pr-4">
                  {isExternalDocument && (
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      Documento
                    </span>
                  )}
                  {!isExternalDocument && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      isTest
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : isRemote
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                          : "bg-primary/10 text-primary"
                    }`}>
                      {isTest ? "Test" : isRemote ? "Remota" : "Presencial"}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(sesion.estado)}`}
                    >
                      {getStatusLabel(sesion.estado)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteSessionError("");
                        setSessionToDelete(sesion);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-80 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Eliminar sesión"
                      title="Eliminar sesión"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Saved AI reports */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Informes IA guardados
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Respuestas clínicas del asistente guardadas como documentos del paciente.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {informes.length} informe{informes.length !== 1 ? "s" : ""}
          </span>
        </div>
        {informeSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            {informeSuccess}
          </div>
        )}
        {informes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aún no hay informes guardados. Guarda una respuesta del chat IA para conservarla como informe clínico.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {informes.map((informe) => (
              <div key={informe.id} className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{informe.titulo || getInformeTipoLabel(informe.tipo)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getInformeTipoLabel(informe.tipo)} · {formatDate(informe.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedInforme(informe)}
                      className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInforme(informe, "pdf")}
                      disabled={downloadingInforme === `${informe.id}-pdf`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {downloadingInforme === `${informe.id}-pdf` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInforme(informe, "docx")}
                      disabled={downloadingInforme === `${informe.id}-docx`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {downloadingInforme === `${informe.id}-docx` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() => setInformeToDelete(informe)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {cleanMarkdownEmphasis(informe.contenido)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedInforme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border/60 bg-card shadow-elevated">
            <div className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {getInformeTipoLabel(selectedInforme.tipo)}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {selectedInforme.titulo || getInformeTipoLabel(selectedInforme.tipo)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generado el {formatDate(selectedInforme.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInforme(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {cleanMarkdownEmphasis(selectedInforme.contenido)}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 p-5">
              <button
                type="button"
                onClick={() => downloadInforme(selectedInforme, "pdf")}
                disabled={downloadingInforme === `${selectedInforme.id}-pdf`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {downloadingInforme === `${selectedInforme.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={() => downloadInforme(selectedInforme, "docx")}
                disabled={downloadingInforme === `${selectedInforme.id}-docx`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {downloadingInforme === `${selectedInforme.id}-docx` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar Word
              </button>
              <button
                type="button"
                onClick={() => setInformeToDelete(selectedInforme)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!informeToDelete}
        title="Eliminar informe IA"
        description={
          informeToDelete
            ? `Se eliminará permanentemente el informe "${informeToDelete.titulo || getInformeTipoLabel(informeToDelete.tipo)}".`
            : ""
        }
        confirmLabel="Eliminar informe"
        confirming={deletingInformeId === informeToDelete?.id}
        error=""
        onCancel={() => {
          if (deletingInformeId) return;
          setInformeToDelete(null);
        }}
        onConfirm={deleteInforme}
      />

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
          <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 animate-fade-in-up sm:grid-cols-[1fr_1fr_auto_auto]">
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
            <button
              type="button"
              onClick={() => {
                const selected = chatConversations.find((c) => c.id === chatId) || null;
                setChatToDelete(selected);
              }}
              disabled={!chatId || deletingChat}
              className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive shadow-subtle transition-all hover:bg-destructive/10 disabled:opacity-50"
            >
              {deletingChat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Eliminar
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

        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preguntas sugeridas
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHAT_SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => selectSuggestedChatPrompt(prompt)}
                disabled={sendingChat || creatingChat}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-subtle transition-colors hover:bg-accent disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
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
    </div>
  );
}
