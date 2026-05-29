"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, formatDuration, formatSeconds } from "@/lib/utils";
import { ArrowLeft, Download, FileText, Loader2, Mic, Save, Square } from "lucide-react";

interface Sesion {
  id: number;
  paciente: number;
  paciente_nombre: string;
  fecha_hora_inicio: string;
  duracion_segundos: number | null;
  audio_path: string;
  origen: "AUDIO" | "DOCUMENTO_EXTERNO";
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
    .map((segmento) => `${getSpeakerPrefix(segmento.hablante)}: ${segmento.texto.trim()}`)
    .join("\n");
}

function normalizeSpeakerPrefix(prefix: string) {
  const normalized = prefix
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "psicologo") return "PSICOLOGO";
  if (normalized === "paciente") return "PACIENTE";
  if (normalized === "documento") return "DOCUMENTO";
  return "";
}

function parseTranscriptText(text: string): {
  entries: Array<{ hablante: string; texto: string }>;
  error: string;
} {
  const entries: Array<{ hablante: string; texto: string }> = [];
  const prefixPattern = /^(psic[oó]logo|paciente|documento)\s*:\s*(.*)$/i;
  let current: { hablante: string; texto: string } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(prefixPattern);
    if (match) {
      current = {
        hablante: normalizeSpeakerPrefix(match[1]),
        texto: match[2].trim(),
      };
      entries.push(current);
      continue;
    }

    if (!current) {
      return {
        entries: [],
        error: "Cada intervención debe comenzar con Psicólogo:, Paciente: o Documento:.",
      };
    }

    current.texto = `${current.texto}\n${line}`.trim();
  }

  return { entries, error: "" };
}

function formatScore(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return value.toFixed(3);
}

function getSpeakerReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    score_sobre_umbral: "Reconocido sobre umbral",
    otro_hablante: "Otro hablante",
    score_bajo: "Score bajo",
    margen_insuficiente: "Margen insuficiente",
    sin_diarizacion: "Sin diarización",
    sin_psicologo_asociado: "Sesión sin psicólogo asociado",
    sin_perfil_ecapa: "Sin perfil ECAPA",
    perfil_legacy_requiere_regrabacion: "Perfil antiguo, requiere regrabación",
    voz_insuficiente_para_embedding: "Voz insuficiente para embedding",
    score_comparado: "Score comparado",
    sin_diarizacion_sin_psicologo_asociado: "Sin diarización y sesión sin psicólogo asociado",
    sin_diarizacion_sin_perfil_ecapa: "Sin diarización y sin perfil ECAPA",
    sin_diarizacion_perfil_legacy_requiere_regrabacion: "Sin diarización y perfil antiguo",
    sin_diarizacion_voz_insuficiente_para_embedding: "Sin diarización y voz insuficiente",
    sin_diarizacion_audio_completo_sobre_umbral: "Sin diarización, audio completo reconocido",
    sin_diarizacion_score_bajo: "Sin diarización y score bajo",
  };
  return labels[reason] || reason || "Sin detalle";
}

function getPyannoteLabel(label: string) {
  if (label === "AUDIO_COMPLETO") return "Audio completo (sin diarización)";
  return label || "Sin etiqueta Pyannote";
}

function getSupportedAudioMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
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

  useEffect(() => {
    loadSesion();
  }, [loadSesion]);

  useEffect(() => {
    if (sesion?.segmentos) {
      setTranscriptText(buildTranscriptText(sesion.segmentos));
    }
  }, [sesion?.id, sesion?.segmentos]);

  useEffect(() => {
    if (!sesion?.audio_path || !["PENDIENTE", "PROCESANDO"].includes(sesion.estado)) return;

    const poll = setInterval(loadSesion, 5000);
    return () => clearInterval(poll);
  }, [sesion?.estado, loadSesion]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio con MediaRecorder.");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      elapsedRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await uploadAudio();
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          elapsedRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accediendo al micrófono:", err);
      setError("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setUploading(true);
  }

  async function uploadAudio() {
    if (chunksRef.current.length === 0) {
      setUploading(false);
      return;
    }

    try {
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const extension = getAudioExtension(mimeType);
      const formData = new FormData();
      formData.append("audio", blob, `sesion-${sesionId}.${extension}`);
      formData.append("duracion_segundos", String(elapsedRef.current));

      const res = await apiFetch(`/sesiones/${sesionId}/upload_audio/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("No se pudo guardar el audio de la sesión.");
        return;
      }

      await loadSesion();
    } catch (err) {
      console.error("Error subiendo audio:", err);
      setError("No se pudo subir el audio al servidor.");
    } finally {
      setUploading(false);
      chunksRef.current = [];
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    setError("");
    setNotesSaved(false);
    try {
      const res = await apiFetch(`/sesiones/${sesionId}/`, {
        method: "PATCH",
        body: JSON.stringify({ notas_sesion: notes }),
      });
      if (!res.ok) {
        setError("No se pudieron guardar las notas.");
        return;
      }
      const data = await res.json();
      setSesion(data);
      setNotesSaved(true);
      window.setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      console.error(err);
      setError("No se pudieron guardar las notas.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveTranscript() {
    if (!sesion) return;

    setError("");
    setTranscriptSaved(false);

    const parsed = parseTranscriptText(transcriptText);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    if (parsed.entries.length !== sesion.segmentos.length) {
      setError(
        `La transcripción debe mantener ${sesion.segmentos.length} intervenciones. Se encontraron ${parsed.entries.length}.`
      );
      return;
    }

    setSavingTranscript(true);
    try {
      for (let index = 0; index < parsed.entries.length; index += 1) {
        const entry = parsed.entries[index];
        const segmento = sesion.segmentos[index];
        const res = await apiFetch(`/sesiones/${sesionId}/segmentos/${segmento.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            texto: entry.texto,
            hablante: entry.hablante,
          }),
        });

        if (!res.ok) {
          let detail = "No se pudo guardar la transcripción.";
          try {
            const data = await res.json();
            detail = data.error || data.detail || detail;
          } catch {
            // Keep generic message.
          }
          setError(detail);
          return;
        }
      }

      await loadSesion();
      setTranscriptSaved(true);
      window.setTimeout(() => {
        setTranscriptSaved(false);
      }, 2500);
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la transcripción.");
    } finally {
      setSavingTranscript(false);
    }
  }

  async function exportPdf() {
    setError("");
    try {
      const res = await apiFetch(`/sesiones/${sesionId}/exportar_pdf/`);
      if (!res.ok) {
        setError("No se pudo exportar el PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sesion-${sesionId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("No se pudo exportar el PDF.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando sesión...
      </div>
    );
  }

  if (!sesion) {
    return <p className="text-destructive">Sesión no encontrada</p>;
  }

  const isExternalDocument = sesion.origen === "DOCUMENTO_EXTERNO";

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/dashboard/pacientes/${id}`)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al paciente
      </button>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {isExternalDocument ? "Documento externo" : "Sesión"} — {formatDate(sesion.fecha_hora_inicio)}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatTime(sesion.fecha_hora_inicio)}
              {!isExternalDocument && sesion.duracion_segundos
                ? ` · ${formatDuration(sesion.duracion_segundos)}`
                : ""}
              {" · "}
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
            </p>
            {isExternalDocument && (
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {sesion.documento_nombre_original || "Documento externo cargado"}
              </p>
            )}
          </div>

          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>

          {!isExternalDocument && !sesion.audio_path && sesion.estado === "PENDIENTE" && (
            <div className="flex items-center gap-3">
              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo audio...
                </div>
              ) : recording ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono tabular-nums text-red-600 animate-pulse">
                    ● {formatSeconds(elapsed)}
                  </span>
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Square className="h-4 w-4" />
                    Detener grabación
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Mic className="h-4 w-4" />
                  Iniciar grabación
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isExternalDocument && sesion.audio_path && ["PENDIENTE", "PROCESANDO"].includes(sesion.estado) && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
            <div>
              <h2 className="font-semibold">Procesando audio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Celery está ejecutando diarización, transcripción y generación de embeddings. La página se actualizará automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isExternalDocument && sesion.speaker_results && sesion.speaker_results.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Reconocimiento de voz</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Scores ECAPA usados para validar si un hablante corresponde al psicólogo.
            </p>
          </div>
          <div className="grid gap-3">
            {sesion.speaker_results.map((result) => (
              <div key={result.id} className="rounded-lg border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {getPyannoteLabel(result.pyannote_label)} → {getSpeakerLabel(result.assigned_hablante)}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      result.assigned_hablante === "PSICOLOGO"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    score {formatScore(result.score)} / umbral {formatScore(result.threshold)}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Razón: {getSpeakerReasonLabel(result.reason)}</span>
                  <span>Duración usada: {formatSeconds(result.total_duration_seconds)}</span>
                  <span>Turnos usados: {result.turn_count}</span>
                  <span>Modelo: {result.model_name || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Notas del psicólogo</h2>
          <div className="flex items-center gap-3">
            {notesSaved && (
              <span className="text-sm font-medium text-green-700">
                Notas guardadas
              </span>
            )}
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingNotes ? "Guardando..." : "Guardar notas"}
            </button>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Notas privadas sobre la sesión, hipótesis clínicas o acuerdos..."
        />
      </div>

      {sesion.segmentos && sesion.segmentos.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {isExternalDocument ? "Contenido extraído editable" : "Transcripción editable"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mantén una intervención por bloque usando el prefijo Psicólogo:, Paciente: o Documento:.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {transcriptSaved && (
                <span className="text-sm font-medium text-green-700">
                  Transcripción guardada
                </span>
              )}
              <button
                onClick={saveTranscript}
                disabled={savingTranscript}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingTranscript ? "Guardando..." : "Guardar transcripción"}
              </button>
            </div>
          </div>
          <textarea
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            rows={Math.min(Math.max(sesion.segmentos.length * 2, 12), 30)}
            className="w-full rounded-md border bg-background px-3 py-2 leading-relaxed"
            placeholder="Psicólogo: Buenos días, ¿cómo estás?\nPaciente: Estoy bien, muchas gracias."
          />
        </div>
      )}

      {sesion.estado === "COMPLETADO" && (!sesion.segmentos || sesion.segmentos.length === 0) && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>
            {isExternalDocument
              ? "Documento cargado sin texto extraído."
              : "Transcripción completada sin segmentos detectados."}
          </p>
        </div>
      )}
    </div>
  );
}
