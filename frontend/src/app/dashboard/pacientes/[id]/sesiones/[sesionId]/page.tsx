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
}

interface Segmento {
  id: number;
  orden: number;
  inicio_segundo: number;
  fin_segundo: number;
  hablante: string;
  texto: string;
  texto_original: string;
}

function getSpeakerLabel(hablante: string) {
  if (hablante === "PSICOLOGO") return "Psicólogo";
  if (hablante === "PACIENTE") return "Paciente";
  return "Documento";
}

function getSegmentTone(hablante: string) {
  if (hablante === "PSICOLOGO") {
    return {
      box: "bg-blue-50 border-l-4 border-blue-400",
      label: "text-blue-700",
    };
  }

  if (hablante === "PACIENTE") {
    return {
      box: "bg-green-50 border-l-4 border-green-400",
      label: "text-green-700",
    };
  }

  return {
    box: "bg-violet-50 border-l-4 border-violet-400",
    label: "text-violet-700",
  };
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
  const [savingSegmentId, setSavingSegmentId] = useState<number | null>(null);
  const [savedSegmentId, setSavedSegmentId] = useState<number | null>(null);

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

  async function saveSegment(segmento: Segmento) {
    setError("");
    setSavedSegmentId(null);
    setSavingSegmentId(segmento.id);
    try {
      const res = await apiFetch(
        `/sesiones/${sesionId}/segmentos/${segmento.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            texto: segmento.texto,
            hablante: segmento.hablante,
          }),
        }
      );
      if (!res.ok) {
        let detail = "No se pudo guardar el segmento.";
        try {
          const data = await res.json();
          detail = data.error || data.detail || detail;
        } catch {
          // Keep generic message.
        }
        setError(detail);
        return;
      }
      const updatedSegment = await res.json();
      updateLocalSegment(segmento.id, updatedSegment);
      setSavedSegmentId(segmento.id);
      window.setTimeout(() => {
        setSavedSegmentId((current) => (current === segmento.id ? null : current));
      }, 2500);
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el segmento.");
    } finally {
      setSavingSegmentId((current) => (current === segmento.id ? null : current));
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

  function updateLocalSegment(segmentoId: number, patch: Partial<Segmento>) {
    setSesion((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        segmentos: prev.segmentos.map((segmento) =>
          segmento.id === segmentoId ? { ...segmento, ...patch } : segmento
        ),
      };
    });
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
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isExternalDocument ? "Contenido extraído editable" : "Transcripción editable"}
          </h2>
          <div className="space-y-3">
            {sesion.segmentos.map((seg) => {
              const tone = getSegmentTone(seg.hablante);
              return (
                <div
                  key={seg.id}
                  className={`rounded-lg p-3 text-sm ${tone.box}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold uppercase ${tone.label}`}>
                      {getSpeakerLabel(seg.hablante)}
                    </span>
                    {!isExternalDocument && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatSeconds(seg.inicio_segundo)} –{" "}
                        {formatSeconds(seg.fin_segundo)}
                      </span>
                    )}
                    <select
                      value={seg.hablante}
                      onChange={(event) =>
                        updateLocalSegment(seg.id, { hablante: event.target.value })
                      }
                      className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {(isExternalDocument || seg.hablante === "DOCUMENTO") && (
                        <option value="DOCUMENTO">Documento</option>
                      )}
                      <option value="PSICOLOGO">Psicólogo</option>
                      <option value="PACIENTE">Paciente</option>
                    </select>
                  </div>
                  <textarea
                    value={seg.texto}
                    onChange={(event) =>
                      updateLocalSegment(seg.id, { texto: event.target.value })
                    }
                    rows={isExternalDocument ? 5 : 3}
                    className="w-full rounded-md border bg-background px-3 py-2 leading-relaxed"
                  />
                  <div className="mt-2 flex justify-end">
                    {savedSegmentId === seg.id && (
                      <span className="mr-3 self-center text-xs font-medium text-green-700">
                        Segmento guardado
                      </span>
                    )}
                    <button
                      onClick={() => saveSegment(seg)}
                      disabled={savingSegmentId === seg.id}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {savingSegmentId === seg.id ? "Guardando..." : "Guardar segmento"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
