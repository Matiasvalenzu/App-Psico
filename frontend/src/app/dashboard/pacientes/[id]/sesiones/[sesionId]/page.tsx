"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration, formatSeconds } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ArrowLeft, ChevronDown, ChevronUp, ClipboardList, Clock, Download, Edit3, ExternalLink, FileText, Loader2, MessageSquare, Mic, Save, Search, Sparkles, Square, Trash2, User, UserCheck, Video, X } from "lucide-react";
import { useAudioRecording } from "@/context/AudioRecordingContext";
import SessionRecordingTips from "@/components/sesion/SessionRecordingTips";
import { RemoteAudioAssistantModal } from "@/components/sesion/RemoteAudioAssistantModal";
import RuedaCreenciasChart, { RuedaDimension } from "@/components/tests/RuedaCreenciasChart";

interface Sesion {
  id: number;
  paciente: number;
  paciente_nombre: string;
  numero_sesion: number | null;
  fecha_hora_inicio: string;
  duracion_segundos: number | null;
  audio_path: string;
  origen: "AUDIO" | "DOCUMENTO_EXTERNO" | "VIRTUAL" | "TEST_PSICOLOGICO";
  plataforma_virtual?: string;
  url_reunion?: string;
  documento_nombre_original: string;
  estado: string;
  notas_sesion: string;
  segmentos: Segmento[];
  speaker_results: SpeakerResult[];
  resultado_test: TestResult | null;
}

interface TestResultSection {
  key: string;
  title: string;
  document_title: string;
  content: string;
}

interface TestResult {
  id: number;
  test_slug: string;
  test_nombre: string;
  puntajes: Record<string, unknown>;
  interpretacion: Record<string, unknown>;
  estado_ia: string;
  secciones: TestResultSection[];
}

interface Segmento {
  id: number;
  orden: number;
  inicio_segundo: number;
  fin_segundo: number;
  hablante: string;
  speaker_label: string;
  speaker_match_score: number | null;
  speaker_match_threshold: number | null;
  speaker_match_model: string;
  texto: string;
  texto_original: string;
}

interface SpeakerResult {
  id: number;
  pyannote_label: string;
  matched_profile_id: number | null;
  score: number | null;
  threshold: number;
  assigned_hablante: string;
  total_duration_seconds: number;
  turn_count: number;
  model_name: string;
  reason: string;
  created_at: string;
}

function getSpeakerLabel(hablante: string) {
  if (hablante === "PSICOLOGO") return "Psicólogo";
  if (hablante === "PACIENTE") return "Paciente";
  return "Documento";
}

function getSpeakerPrefix(hablante: string) {
  if (hablante === "PSICOLOGO") return "Psicólogo";
  if (hablante === "PACIENTE") return "Paciente";
  return "Documento";
}

function buildTranscriptText(segmentos: Segmento[]) {
  return segmentos
    .map((seg) => `${getSpeakerPrefix(seg.hablante)}: ${seg.texto.trim()}`)
    .join("\n");
}

function normalizeSpeakerPrefix(prefix: string) {
  const n = prefix.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n === "psicologo") return "PSICOLOGO";
  if (n === "paciente") return "PACIENTE";
  if (n === "documento") return "DOCUMENTO";
  return "";
}

function parseTranscriptText(text: string) {
  const entries: Array<{ hablante: string; texto: string }> = [];
  const pattern = /^(psic[oó]logo|paciente|documento)\s*:\s*(.*)$/i;
  let current: { hablante: string; texto: string } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(pattern);
    if (m) {
      current = { hablante: normalizeSpeakerPrefix(m[1]), texto: m[2].trim() };
      entries.push(current);
      continue;
    }
    if (!current) return { entries: [], error: "Cada intervención debe comenzar con Psicólogo:, Paciente: o Documento:." };
    current.texto = `${current.texto}\n${line}`.trim();
  }
  return { entries, error: "" };
}

function getSpeakerTone(hablante: string) {
  if (hablante === "PSICOLOGO") return "bg-primary/5 border-primary/20 text-primary";
  if (hablante === "PACIENTE") return "bg-emerald-50/50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300";
  return "bg-violet-50/50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300";
}

function getAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function getAudioExtension(mime: string) {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

function formatScore(v: number | null | undefined) {
  return typeof v === "number" ? v.toFixed(3) : "-";
}

function getReasonLabel(r: string) {
  const m: Record<string, string> = {
    score_sobre_umbral: "Reconocido sobre umbral",
    otro_hablante: "Otro hablante",
    score_bajo: "Score bajo",
    margen_insuficiente: "Margen insuficiente",
    sin_diarizacion: "Sin diarización",
    sin_psicologo_asociado: "Sesión sin psicólogo asociado",
    sin_perfil_ecapa: "Sin perfil ECAPA",
    perfil_legacy_requiere_regrabacion: "Perfil antiguo, requiere regrabación",
    voz_insuficiente_para_embedding: "Voz insuficiente",
    score_comparado: "Score comparado",
    sin_diarizacion_sin_psicologo_asociado: "Sin diarización / sin psicólogo",
    sin_diarizacion_sin_perfil_ecapa: "Sin diarización / sin perfil ECAPA",
    sin_diarizacion_perfil_legacy_requiere_regrabacion: "Sin diarización / perfil antiguo",
    sin_diarizacion_voz_insuficiente_para_embedding: "Sin diarización / voz insuficiente",
    sin_diarizacion_audio_completo_sobre_umbral: "Audio completo reconocido",
    sin_diarizacion_score_bajo: "Sin diarización / score bajo",
  };
  return m[r] || r || "Sin detalle";
}

function getPyannoteLabel(label: string) {
  if (label === "AUDIO_COMPLETO") return "Audio completo (sin diarización)";
  return label || "Sin etiqueta";
}

function cleanMarkdownEmphasis(text: string) {
  return (text || "")
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => value.trim().toUpperCase())
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

function sectionTone(key: string) {
  if (key === "respuestas") return "border-sky-200 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20";
  if (key === "puntajes") return "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20";
  if (key === "interpretacion") return "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20";
  return "border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20";
}

export default function SesionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const sesionId = params.sesionId as string;

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [deleteSessionError, setDeleteSessionError] = useState("");
  const [downloadingTestSection, setDownloadingTestSection] = useState<string | null>(null);
  const [remoteAssistantOpen, setRemoteAssistantOpen] = useState(false);
  const [transcriptTab, setTranscriptTab] = useState<"dialogue" | "editor">("dialogue");
  const [searchTerm, setSearchTerm] = useState("");
  const [speakerAuditOpen, setSpeakerAuditOpen] = useState(false);

  function insertQuickSnippet(title: string) {
    setNotes((prev) => {
      const trimmed = prev.trim();
      const addition = `\n\n[${title}]\n- `;
      return trimmed ? `${trimmed}${addition}` : `[${title}]\n- `;
    });
  }

  const {
    isRecording: isGlobalRecording,
    elapsed: globalElapsed,
    recordingSessionId,
    isUploading: isGlobalUploading,
    uploadError: globalUploadError,
    lastUploadedSessionId,
    startRecording: startGlobalRecording,
    stopRecording: stopGlobalRecording,
  } = useAudioRecording();

  const isCurrentSessionRecording =
    isGlobalRecording && String(recordingSessionId) === String(sesionId);
  const isCurrentSessionUploading =
    isGlobalUploading && String(recordingSessionId) === String(sesionId);

  const loadSesion = useCallback(async () => {
    try {
      const res = await apiFetch(`/sesiones/${sesionId}/`);
      const data = await res.json();
      setSesion(data);
      setNotes(data.notas_sesion || "");
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la sesión.");
    } finally {
      setLoading(false);
    }
  }, [sesionId]);

  useEffect(() => { loadSesion(); }, [loadSesion]);

  useEffect(() => {
    if (lastUploadedSessionId && String(lastUploadedSessionId) === String(sesionId)) {
      loadSesion();
    }
  }, [lastUploadedSessionId, sesionId, loadSesion]);

  useEffect(() => {
    if (sesion?.segmentos) setTranscriptText(buildTranscriptText(sesion.segmentos));
  }, [sesion?.id, sesion?.segmentos]);

  useEffect(() => {
    if (!sesion?.audio_path || !["PENDIENTE", "PROCESANDO"].includes(sesion.estado)) return;
    const poll = setInterval(loadSesion, 5000);
    return () => clearInterval(poll);
  }, [sesion?.estado, loadSesion]);

  async function handleStartRecording() {
    if (!sesion) return;
    setError("");
    const ok = await startGlobalRecording({
      sesionId: sesion.id,
      pacienteId: id,
      pacienteNombre: sesion.paciente_nombre,
      numeroSesion: sesion.numero_sesion,
    });
    if (!ok && globalUploadError) {
      setError(globalUploadError);
    }
  }

  async function handleStopRecording() {
    await stopGlobalRecording();
  }

  async function saveNotes() {
    setSavingNotes(true); setError(""); setNotesSaved(false);
    try {
      const res = await apiFetch(`/sesiones/${sesionId}/`, { method: "PATCH", body: JSON.stringify({ notas_sesion: notes }) });
      if (!res.ok) { setError("No se pudieron guardar las notas."); return; }
      const data = await res.json();
      setSesion(data);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      console.error(err);
      setError("No se pudieron guardar las notas.");
    } finally { setSavingNotes(false); }
  }

  async function saveTranscript() {
    if (!sesion) return;
    setError(""); setTranscriptSaved(false);
    const parsed = parseTranscriptText(transcriptText);
    if (parsed.error) { setError(parsed.error); return; }
    if (parsed.entries.length !== sesion.segmentos.length) {
      setError(`La transcripción debe mantener ${sesion.segmentos.length} intervenciones.`);
      return;
    }
    setSavingTranscript(true);
    try {
      for (let i = 0; i < parsed.entries.length; i++) {
        const entry = parsed.entries[i];
        const seg = sesion.segmentos[i];
        const res = await apiFetch(`/sesiones/${sesionId}/segmentos/${seg.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ texto: entry.texto, hablante: entry.hablante }),
        });
        if (!res.ok) { setError("No se pudo guardar la transcripción."); return; }
      }
      await loadSesion();
      setTranscriptSaved(true);
      setTimeout(() => setTranscriptSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la transcripción.");
    } finally { setSavingTranscript(false); }
  }

  function exportPdf() {
    apiFetch(`/sesiones/${sesionId}/exportar_pdf/`).then(async (res) => {
      if (!res.ok) { setError("No se pudo exportar el PDF."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `sesion-${sesionId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    }).catch(() => setError("No se pudo exportar el PDF."));
  }

  function exportDocx() {
    apiFetch(`/sesiones/${sesionId}/exportar_docx/`).then(async (res) => {
      if (!res.ok) { setError("No se pudo exportar el Word."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `sesion-${sesionId}.docx`; a.click();
      URL.revokeObjectURL(url);
    }).catch(() => setError("No se pudo exportar el Word."));
  }

  async function downloadTestSection(sectionKey: string, format: "pdf" | "docx") {
    const key = `${sectionKey}-${format}`;
    setDownloadingTestSection(key);
    setError("");
    try {
      const res = await apiFetch(`/sesiones/${sesionId}/exportar_test_seccion/?seccion=${sectionKey}&formato=${format}`);
      if (!res.ok) {
        setError(`No se pudo descargar la sección en ${format.toUpperCase()}.`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `test-${sectionKey}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(`No se pudo descargar la sección en ${format.toUpperCase()}.`);
    } finally {
      setDownloadingTestSection(null);
    }
  }

  async function deleteSession() {
    if (!sesion) return;
    setDeletingSession(true);
    setDeleteSessionError("");
    try {
      const res = await apiFetch(`/sesiones/${sesion.id}/`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteSessionError("No se pudo eliminar la sesión. Inténtalo nuevamente.");
        return;
      }
      if (isCurrentSessionRecording) {
        await stopGlobalRecording();
      }
      router.replace(`/dashboard/pacientes/${id}`);
    } catch (err) {
      console.error(err);
      setDeleteSessionError("No se pudo eliminar la sesión. Inténtalo nuevamente.");
    } finally {
      setDeletingSession(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando sesión...</div>;
  if (!sesion) return <p className="text-destructive">Sesión no encontrada</p>;

  const isExternalDoc = sesion.origen === "DOCUMENTO_EXTERNO";
  const isVirtual = sesion.origen === "VIRTUAL";
  const isTest = sesion.origen === "TEST_PSICOLOGICO";
  const sessionTitle = isExternalDoc
    ? "Documento externo"
    : isTest
      ? sesion.documento_nombre_original || "Test psicológico"
    : sesion.numero_sesion
      ? `Sesión ${sesion.numero_sesion}`
      : isVirtual
        ? "Sesión remota"
        : "Sesión presencial";

  const filteredSegmentos = (sesion.segmentos || []).filter((seg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      seg.texto.toLowerCase().includes(term) ||
      getSpeakerLabel(seg.hablante).toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Back navigation & breadcrumb */}
      <div className="sticky top-14 md:top-16 z-20 -mx-4 -mt-4 mb-4 px-4 py-2.5 bg-background/90 backdrop-blur-md border-b border-border/40 md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/pacientes/${id}`)}
            className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3.5 py-1.5 text-sm font-semibold text-foreground/80 shadow-xs backdrop-blur-sm transition-all hover:bg-muted/60 hover:text-foreground active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Paciente</span>
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Pacientes</span>
            <span>/</span>
            <span className="font-medium text-foreground">{sesion.paciente_nombre || "Paciente"}</span>
            <span>/</span>
            <span className="text-primary font-medium">{sessionTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            sesion.estado === "COMPLETADO" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" :
            sesion.estado === "PROCESANDO" ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300" :
            "bg-muted/60 text-muted-foreground border border-border/60"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              sesion.estado === "COMPLETADO" ? "bg-emerald-500" :
              sesion.estado === "PROCESANDO" ? "bg-amber-500 animate-ping" : "bg-muted-foreground"
            }`} />
            {sesion.estado === "COMPLETADO" ? "Completado" : sesion.estado === "PROCESANDO" ? "Procesando audio..." : sesion.estado}
          </span>
        </div>
      </div>

      {/* Session header */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 shrink-0 rounded-xl border flex items-center justify-center ${
              isTest ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" :
              isVirtual ? "border-sky-500/30 bg-sky-500/10 text-sky-600" :
              isExternalDoc ? "border-violet-500/30 bg-violet-500/10 text-violet-600" :
              "border-primary/30 bg-primary/10 text-primary"
            }`}>
              {isTest ? (
                <ClipboardList className="h-6 w-6" />
              ) : isVirtual ? (
                <Video className="h-6 w-6" />
              ) : isExternalDoc ? (
                <FileText className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {sessionTitle}
                </h1>
                <span className="text-muted-foreground">—</span>
                <span className="text-base font-semibold text-foreground/85">
                  {formatDate(sesion.fecha_hora_inicio)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/60 px-2.5 py-1 font-medium text-foreground/80">
                  {isTest ? "Test psicológico" : isVirtual ? "Sesión Remota" : isExternalDoc ? "Documento" : "Sesión Presencial"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/60 px-2.5 py-1 font-medium text-foreground/80">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {formatTime(sesion.fecha_hora_inicio)}
                </span>
                {!isExternalDoc && sesion.duracion_segundos && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/60 px-2.5 py-1 font-medium text-foreground/80">
                    Duración: {formatDuration(sesion.duracion_segundos)}
                  </span>
                )}
                {sesion.segmentos && sesion.segmentos.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 font-medium text-primary">
                    <MessageSquare className="h-3 w-3" />
                    {sesion.segmentos.length} intervenciones
                  </span>
                )}
              </div>

              {isExternalDoc && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg border border-border/40">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {sesion.documento_nombre_original || "Documento externo cargado"}
                </p>
              )}
              {isTest && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-200/50">
                  <ClipboardList className="h-3.5 w-3.5" /> Resultado guardado como sesión clínica y disponible para el chat IA.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isVirtual && sesion.estado === "PENDIENTE" && (
              <div className="flex flex-wrap items-center gap-2">
                {sesion.url_reunion && (
                  <a
                    href={sesion.url_reunion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <Video className="h-3.5 w-3.5 text-sky-600" />
                    Abrir Google Meet
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {isCurrentSessionRecording ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono tabular-nums text-sky-600 animate-pulse flex items-center gap-1.5 font-semibold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                      </span>
                      {formatSeconds(globalElapsed)}
                    </span>
                    <button
                      onClick={handleStopRecording}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground shadow-xs transition-all hover:bg-destructive/90 cursor-pointer"
                    >
                      <Square className="h-3.5 w-3.5" /> Detener grabación
                    </button>
                  </div>
                ) : isCurrentSessionUploading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo audio...
                  </div>
                ) : (
                  <button
                    onClick={() => setRemoteAssistantOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-sky-700 cursor-pointer"
                  >
                    <Mic className="h-3.5 w-3.5" /> Grabar llamada Meet
                  </button>
                )}
              </div>
            )}

            {!isExternalDoc && !isVirtual && !isTest && !sesion.audio_path && sesion.estado === "PENDIENTE" && (
              <div className="flex items-center gap-3">
                {isCurrentSessionUploading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Subiendo audio...</div>
                ) : isCurrentSessionRecording ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono tabular-nums text-primary font-semibold animate-pulse">{formatSeconds(globalElapsed)}</span>
                    <button onClick={handleStopRecording} className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground shadow-xs transition-all hover:bg-destructive/90 cursor-pointer">
                      <Square className="h-3.5 w-3.5" /> Detener
                    </button>
                  </div>
                ) : (
                  <button onClick={handleStartRecording} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 hover:shadow-md cursor-pointer">
                    <Mic className="h-3.5 w-3.5" /> Iniciar grabación
                  </button>
                )}
              </div>
            )}

            <button
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3.5 py-2 text-xs font-semibold text-foreground/80 shadow-xs transition-all hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Exportar PDF
            </button>
            <button
              onClick={exportDocx}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3.5 py-2 text-xs font-semibold text-foreground/80 shadow-xs transition-all hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" /> Exportar Word
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteSessionError("");
                setDeleteDialogOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive shadow-xs transition-all hover:bg-destructive/15 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> {isTest ? "Eliminar test" : "Eliminar sesión"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive font-medium">{error}</div>}

      {/* Main 2-Column Clinical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Diálogo y Transcripción o Resultados de Test */}
        <div className="lg:col-span-7 space-y-6">
          {/* Guía y tips para grabación presencial */}
          {!isExternalDoc && !isVirtual && !isTest && !sesion.audio_path && sesion.estado === "PENDIENTE" && (
            <SessionRecordingTips />
          )}

          {/* Banner de procesamiento */}
          {!isExternalDoc && !isTest && sesion.audio_path && ["PENDIENTE", "PROCESANDO"].includes(sesion.estado) && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-6 dark:border-amber-800/60 dark:bg-amber-950/30 shadow-card">
              <div className="flex items-start gap-3.5">
                <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-amber-600 shrink-0" />
                <div>
                  <h2 className="font-semibold text-amber-900 dark:text-amber-200">Procesando audio de la sesión</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Diarización, transcripción con Whisper y reconocimiento de voz (ECAPA-TDNN) en curso. Esta vista se actualizará automáticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transcripción interactiva */}
          {!isTest && sesion.segmentos && sesion.segmentos.length > 0 && (
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-card">
              {/* Header con tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4.5 w-4.5 text-primary" />
                    {isExternalDoc ? "Contenido extraído del documento" : "Diálogo y Transcripción Clínica"}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sesion.segmentos.length} intervenciones registradas
                  </p>
                </div>

                {!isExternalDoc && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1 border border-border/60 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setTranscriptTab("dialogue")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        transcriptTab === "dialogue"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Vista Diálogo
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranscriptTab("editor")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        transcriptTab === "editor"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editor Rápido
                    </button>
                  </div>
                )}
              </div>

              {/* Vista Diálogo con buscador y burbujas */}
              {transcriptTab === "dialogue" ? (
                <div className="space-y-3.5">
                  {/* Buscador de intervenciones */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar palabra o hablante..."
                        className="w-full rounded-xl border border-border/70 bg-background/60 pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {searchTerm && (
                      <span className="text-xs text-muted-foreground font-medium shrink-0">
                        {filteredSegmentos.length} de {sesion.segmentos.length}
                      </span>
                    )}
                  </div>

                  {/* Lista de intervenciones con burbujas clínicas */}
                  <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                    {filteredSegmentos.length > 0 ? (
                      filteredSegmentos.map((seg) => {
                        const isPsicologo = seg.hablante === "PSICOLOGO";
                        const isPaciente = seg.hablante === "PACIENTE";
                        return (
                          <div
                            key={seg.id}
                            className={`rounded-xl border p-4 transition-all ${
                              isPsicologo
                                ? "border-primary/25 bg-primary/[0.03] dark:bg-primary/10"
                                : isPaciente
                                ? "border-emerald-500/25 bg-emerald-500/[0.03] dark:bg-emerald-950/20"
                                : "border-violet-500/25 bg-violet-500/[0.03] dark:bg-violet-950/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  isPsicologo
                                    ? "bg-primary/10 text-primary border border-primary/25"
                                    : isPaciente
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/40"
                                    : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-300/40"
                                }`}>
                                  {isPsicologo ? <UserCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                  {getSpeakerLabel(seg.hablante)}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatSeconds(seg.inicio_segundo)} - {formatSeconds(seg.fin_segundo)}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground/60 font-mono">
                                #{seg.orden}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed text-foreground/90 font-sans whitespace-pre-wrap">
                              {seg.texto}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No se encontraron intervenciones que coincidan con &quot;{searchTerm}&quot;.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Modo Editor de Texto estructurado */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Mantén una intervención por bloque con prefijo Psicólogo:, Paciente: o Documento:</span>
                    <div className="flex items-center gap-2">
                      {transcriptSaved && <span className="text-xs font-medium text-emerald-600">Guardado</span>}
                      <button
                        onClick={saveTranscript}
                        disabled={savingTranscript}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" /> {savingTranscript ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    rows={22}
                    className="w-full rounded-xl border border-input bg-background/80 px-4 py-3 text-xs leading-relaxed font-mono transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Psicólogo: Buenos días, ¿cómo estás?\nPaciente: Estoy bien, muchas gracias."
                  />
                </div>
              )}
            </div>
          )}

          {/* Test results (si la sesión es origen test) */}
          {isTest && sesion.resultado_test?.secciones?.length ? (
            <div className="space-y-6">
              {/* Visualización Gráfica para Rueda de Creencias Limitantes */}
              {sesion.resultado_test.test_slug === "rueda-creencias" && (
                <div className="space-y-5">
                  {/* Banner de Creencias Predominantes */}
                  {Array.isArray(sesion.resultado_test.puntajes?.highest_dimensions) &&
                    (sesion.resultado_test.puntajes.highest_dimensions as RuedaDimension[]).length > 0 && (
                      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 shadow-card">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <h3 className="text-base font-bold text-foreground">
                            Creencias Predominantes en el Paciente
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Según las respuestas registradas, el paciente se sitúa principalmente en las siguientes creencias:
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {(sesion.resultado_test.puntajes.highest_dimensions as RuedaDimension[]).map(
                            (dim, idx) => (
                              <div
                                key={dim.id}
                                className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                                    #{idx + 1} Creencia {dim.id}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      dim.actual >= 8
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    }`}
                                  >
                                    {dim.actual >= 8 ? "Alto / Urgente" : "Moderado"}
                                  </span>
                                </div>
                                <h4 className="mt-1 text-sm font-bold text-foreground">{dim.name}</h4>
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                  <span>
                                    Actual: <strong className="text-foreground">{dim.actual}.00</strong>
                                  </span>
                                  <span>
                                    Meta: <strong className="text-indigo-600 dark:text-indigo-400">{dim.deseado}.00</strong>
                                  </span>
                                  <span>
                                    Brecha: <strong className="text-rose-500">{dim.brecha}</strong>
                                  </span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Componente Gráfico de Radar / Telaraña */}
                  {Array.isArray(sesion.resultado_test.puntajes?.dimensions) && (
                    <RuedaCreenciasChart
                      dimensions={sesion.resultado_test.puntajes.dimensions as RuedaDimension[]}
                      promedioActual={sesion.resultado_test.puntajes.promedio_actual as number}
                      cargaTotal={sesion.resultado_test.puntajes.total_score as number}
                    />
                  )}
                </div>
              )}

              {/* Secciones del Documento */}
              {sesion.resultado_test.secciones.map((section) => (
                <section
                  key={section.key}
                  className={`rounded-2xl border p-6 shadow-card ${sectionTone(section.key)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {section.document_title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadTestSection(section.key, "pdf")}
                        disabled={downloadingTestSection === `${section.key}-pdf`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold shadow-xs transition-all hover:bg-accent disabled:opacity-50 cursor-pointer"
                      >
                        {downloadingTestSection === `${section.key}-pdf` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTestSection(section.key, "docx")}
                        disabled={downloadingTestSection === `${section.key}-docx`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold shadow-xs transition-all hover:bg-accent disabled:opacity-50 cursor-pointer"
                      >
                        {downloadingTestSection === `${section.key}-docx` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                        Word
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-border/60 bg-card/80 px-4 py-3 text-sm leading-relaxed shadow-inner">
                    <p className="whitespace-pre-wrap">{cleanMarkdownEmphasis(section.content)}</p>
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {/* Empty state si no hay segmentos */}
          {sesion.estado === "COMPLETADO" && (!sesion.segmentos || sesion.segmentos.length === 0) && !isTest && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card py-16 text-center shadow-card">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {isExternalDoc ? "Documento cargado sin texto extraído." : "Transcripción completada sin segmentos detectados."}
              </p>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Panel de Notas Clínicas Sticky & Auditoría de Voz */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          {/* Notas del psicólogo */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Edit3 className="h-4.5 w-4.5 text-primary" />
                  Notas del psicólogo
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Apuntes privados, impresiones clínicas y acuerdos
                </p>
              </div>

              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                {savingNotes ? "Guardando..." : "Guardar notas"}
              </button>
            </div>

            {/* Atajos rápidos para estructurar notas */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground font-medium mr-1">Atajos:</span>
              <button
                type="button"
                onClick={() => insertQuickSnippet("Hipótesis Clínica")}
                className="rounded-lg border border-border/70 bg-muted/30 px-2 py-1 font-medium text-foreground/80 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
              >
                + Hipótesis
              </button>
              <button
                type="button"
                onClick={() => insertQuickSnippet("Intervención Realizada")}
                className="rounded-lg border border-border/70 bg-muted/30 px-2 py-1 font-medium text-foreground/80 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
              >
                + Intervención
              </button>
              <button
                type="button"
                onClick={() => insertQuickSnippet("Acuerdos / Tareas")}
                className="rounded-lg border border-border/70 bg-muted/30 px-2 py-1 font-medium text-foreground/80 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
              >
                + Acuerdos
              </button>
            </div>

            {/* Textarea de notas */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={14}
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-xs leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="Notas privadas sobre la sesión, hipótesis clínicas, evolución del paciente, acuerdos tomados..."
            />

            {/* Footer de notas */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{notes.length} caracteres</span>
              {notesSaved && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Notas guardadas
                </span>
              )}
            </div>
          </div>

          {/* Reconocimiento de voz técnico (ECAPA-TDNN) en acordeón colapsable */}
          {!isExternalDoc && !isVirtual && !isTest && sesion.speaker_results && sesion.speaker_results.length > 0 && (
            <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all">
              <button
                type="button"
                onClick={() => setSpeakerAuditOpen(!speakerAuditOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Mic className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Reconocimiento de voz</h3>
                    <p className="text-[11px] text-muted-foreground">ECAPA-TDNN ({sesion.speaker_results.length} hablante{sesion.speaker_results.length > 1 ? "s" : ""})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Auditoría IA
                  </span>
                  {speakerAuditOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {speakerAuditOpen && (
                <div className="p-4 pt-0 border-t border-border/60 space-y-3 mt-1">
                  {sesion.speaker_results.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-xl border p-3.5 text-xs transition-all ${
                        r.assigned_hablante === "PSICOLOGO"
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/70 bg-card"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{getPyannoteLabel(r.pyannote_label)}</span>
                          <span>→</span>
                          <span className={r.assigned_hablante === "PSICOLOGO" ? "text-primary" : ""}>
                            {getSpeakerLabel(r.assigned_hablante)}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.assigned_hablante === "PSICOLOGO" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          score {formatScore(r.score)} / {formatScore(r.threshold)}
                        </span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                        <span>Razón: {getReasonLabel(r.reason)}</span>
                        <span>Duración: {formatSeconds(r.total_duration_seconds)}</span>
                        <span>Turnos: {r.turn_count}</span>
                        <span className="truncate">Modelo: {r.model_name || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={isTest ? "Eliminar test" : "Eliminar sesión"}
        description={`Esta acción eliminará permanentemente ${isTest ? "el resultado del test" : "la sesión"} del ${formatDate(sesion.fecha_hora_inicio)} a las ${formatTime(sesion.fecha_hora_inicio)}. No se puede deshacer.`}
        confirmLabel={isTest ? "Eliminar test" : "Eliminar sesión"}
        confirming={deletingSession}
        error={deleteSessionError}
        onCancel={() => {
          if (deletingSession) return;
          setDeleteDialogOpen(false);
          setDeleteSessionError("");
        }}
        onConfirm={deleteSession}
      />

      {remoteAssistantOpen && (
        <RemoteAudioAssistantModal
          open={remoteAssistantOpen}
          onClose={() => {
            setRemoteAssistantOpen(false);
            loadSesion();
          }}
          sesionId={sesion.id}
          pacienteId={sesion.paciente}
          pacienteNombre={sesion.paciente_nombre || "Paciente"}
          meetUrl={sesion.url_reunion || undefined}
          onRecordingStarted={() => {
            loadSesion();
          }}
        />
      )}
    </div>
  );
}
