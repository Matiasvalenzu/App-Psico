"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration, formatSeconds } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ArrowLeft, Download, FileText, Loader2, Mic, Save, Square, Trash2, Video } from "lucide-react";

interface Sesion {
  id: number;
  paciente: number;
  paciente_nombre: string;
  numero_sesion: number | null;
  fecha_hora_inicio: string;
  duracion_segundos: number | null;
  audio_path: string;
  origen: "AUDIO" | "DOCUMENTO_EXTERNO" | "VIRTUAL";
  documento_nombre_original: string;
  estado: string;
  notas_sesion: string;
  segmentos: Segmento[];
  speaker_results: SpeakerResult[];
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

export default function SesionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const sesionId = params.sesionId as string;

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (sesion?.segmentos) setTranscriptText(buildTranscriptText(sesion.segmentos));
  }, [sesion?.id, sesion?.segmentos]);

  useEffect(() => {
    if (!sesion?.audio_path || !["PENDIENTE", "PROCESANDO"].includes(sesion.estado)) return;
    const poll = setInterval(loadSesion, 5000);
    return () => clearInterval(poll);
  }, [sesion?.estado, loadSesion]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getAudioMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      elapsedRef.current = 0;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await uploadAudio();
      };
      rec.start(1000);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      }), 1000);
    } catch {
      setError("No se pudo acceder al micrófono. Revisa permisos del navegador.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setUploading(true);
  }

  async function uploadAudio() {
    if (chunksRef.current.length === 0) { setUploading(false); return; }
    try {
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const extension = getAudioExtension(mimeType);
      const formData = new FormData();
      formData.append("audio", blob, `sesion-${sesionId}.${extension}`);
      formData.append("duracion_segundos", String(elapsedRef.current));
      const res = await apiFetch(`/sesiones/${sesionId}/upload_audio/`, { method: "POST", body: formData });
      if (!res.ok) { setError("No se pudo guardar el audio de la sesión."); return; }
      await loadSesion();
    } catch (err) {
      console.error(err);
      setError("No se pudo subir el audio.");
    } finally {
      setUploading(false);
      chunksRef.current = [];
    }
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
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
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
  const sessionTitle = isExternalDoc
    ? "Documento externo"
    : sesion.numero_sesion
      ? `Sesión ${sesion.numero_sesion}`
      : isVirtual
        ? "Sesión remota"
        : "Sesión presencial";

  return (
    <div className="space-y-6">
      <button onClick={() => router.push(`/dashboard/pacientes/${id}`)} className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al paciente
      </button>

      {/* Session header */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              {isVirtual && !isExternalDoc ? (
                <>
                  <Video className="h-5 w-5 text-sky-500" />
                </>
              ) : null}
              {sessionTitle}
              {" "}— {formatDate(sesion.fecha_hora_inicio)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {!isExternalDoc && <span>{isVirtual ? "Remota" : "Presencial"}</span>}
              <span>{formatTime(sesion.fecha_hora_inicio)}</span>
              {!isExternalDoc && sesion.duracion_segundos && <span>{formatDuration(sesion.duracion_segundos)}</span>}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                sesion.estado === "COMPLETADO" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" :
                sesion.estado === "PROCESANDO" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              }`}>{sesion.estado}</span>
            </div>
            {isExternalDoc && (
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" /> {sesion.documento_nombre_original || "Documento externo cargado"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteSessionError("");
                setDeleteDialogOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive shadow-subtle transition-all hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Eliminar sesión
            </button>
            <button onClick={exportPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-subtle transition-all hover:bg-accent">
              <Download className="h-4 w-4" /> Exportar PDF
            </button>
            {isVirtual && sesion.estado === "PENDIENTE" && (
              <div className="flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                <Video className="h-4 w-4 flex-shrink-0" />
                Sesión remota pendiente — activa la extensión Chrome durante la reunión
              </div>
            )}
            {!isExternalDoc && !isVirtual && !sesion.audio_path && sesion.estado === "PENDIENTE" && (
              <div className="flex items-center gap-3">
                {uploading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Subiendo audio...</div>
                ) : recording ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono tabular-nums text-primary animate-pulse">{formatSeconds(elapsed)}</span>
                    <button onClick={stopRecording} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-subtle transition-all hover:bg-destructive/90">
                      <Square className="h-4 w-4" /> Detener
                    </button>
                  </div>
                ) : (
                  <button onClick={startRecording} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card">
                    <Mic className="h-4 w-4" /> Iniciar grabación
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar sesión"
        description={`Esta acción eliminará permanentemente la sesión del ${formatDate(sesion.fecha_hora_inicio)} a las ${formatTime(sesion.fecha_hora_inicio)}. No se puede deshacer.`}
        confirmLabel="Eliminar sesión"
        confirming={deletingSession}
        error={deleteSessionError}
        onCancel={() => {
          if (deletingSession) return;
          setDeleteDialogOpen(false);
          setDeleteSessionError("");
        }}
        onConfirm={deleteSession}
      />

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">{error}</div>}

      {!isExternalDoc && sesion.audio_path && ["PENDIENTE", "PROCESANDO"].includes(sesion.estado) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-amber-600" />
            <div>
              <h2 className="font-semibold">Procesando audio</h2>
              <p className="mt-1 text-sm text-muted-foreground">Diarización, transcripción y reconocimiento de voz en curso. La página se actualizará.</p>
            </div>
          </div>
        </div>
      )}

      {/* Speaker recognition */}
      {!isExternalDoc && !isVirtual && sesion.speaker_results && sesion.speaker_results.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4 shadow-card">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Reconocimiento de voz</h2>
            <p className="mt-1 text-sm text-muted-foreground">Identificación del psicólogo mediante ECAPA-TDNN</p>
          </div>
          <div className="grid gap-3">
            {sesion.speaker_results.map((r) => (
              <div key={r.id} className={`rounded-xl border p-4 shadow-subtle transition-all ${
                r.assigned_hablante === "PSICOLOGO"
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/60 bg-card"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    {getPyannoteLabel(r.pyannote_label)} → <span className={r.assigned_hablante === "PSICOLOGO" ? "text-primary font-semibold" : ""}>{getSpeakerLabel(r.assigned_hablante)}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.assigned_hablante === "PSICOLOGO" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    score {formatScore(r.score)} / {formatScore(r.threshold)}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Razón: {getReasonLabel(r.reason)}</span>
                  <span>Duración: {formatSeconds(r.total_duration_seconds)}</span>
                  <span>Turnos: {r.turn_count}</span>
                  <span className="truncate">Modelo: {r.model_name || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3 shadow-subtle">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Notas del psicólogo</h2>
          <div className="flex items-center gap-3">
            {notesSaved && <span className="text-sm font-medium text-emerald-600">Notas guardadas</span>}
            <button onClick={saveNotes} disabled={savingNotes} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50">
              <Save className="h-4 w-4" /> {savingNotes ? "Guardando..." : "Guardar notas"}
            </button>
          </div>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Notas privadas sobre la sesión, hipótesis clínicas..." />
      </div>

      {/* Transcript */}
      {sesion.segmentos && sesion.segmentos.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{isExternalDoc ? "Contenido extraído editable" : "Transcripción editable"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mantén una intervención por bloque con prefijo Psicólogo:, Paciente: o Documento:</p>
            </div>
            <div className="flex items-center gap-3">
              {transcriptSaved && <span className="text-sm font-medium text-emerald-600">Transcripción guardada</span>}
              <button onClick={saveTranscript} disabled={savingTranscript} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {savingTranscript ? "Guardando..." : "Guardar transcripción"}
              </button>
            </div>
          </div>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            rows={Math.min(Math.max(sesion.segmentos.length * 2, 12), 30)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed font-mono transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Psicólogo: Buenos días, ¿cómo estás?\nPaciente: Estoy bien, muchas gracias."
          />
        </div>
      )}

      {sesion.estado === "COMPLETADO" && (!sesion.segmentos || sesion.segmentos.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center shadow-subtle">
          <p className="text-sm text-muted-foreground">{isExternalDoc ? "Documento cargado sin texto extraído." : "Transcripción completada sin segmentos detectados."}</p>
        </div>
      )}
    </div>
  );
}
