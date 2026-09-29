"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useDualTrackRecorder } from "@/hooks/useDualTrackRecorder";
import { ControlButton, MicMeter, VideoView, formatElapsed } from "@/components/sesion/SalaMedia";

interface SesionSala {
  id: number;
  paciente: number;
  paciente_nombre: string;
  fecha_hora_inicio: string;
  notas_sesion: string;
  estado_videollamada?: string;
}

interface PacienteFicha {
  nombre_completo?: string;
  motivo_consulta?: string;
  diagnostico_sospechado?: string;
  medicacion_actual?: string;
  riesgo_suicida?: boolean;
}

interface SesionPrevia {
  id: number;
  numero_sesion: number | null;
  fecha_hora_inicio: string;
  notas_sesion: string;
}

type Phase = "loading" | "error" | "lobby" | "call" | "finishing";
type SaveState = "idle" | "saving" | "saved" | "error";

export default function SalaPsicologoPage() {
  const { id: pacienteId, sesionId } = useParams<{ id: string; sesionId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [sesion, setSesion] = useState<SesionSala | null>(null);
  const [paciente, setPaciente] = useState<PacienteFicha | null>(null);
  const [previas, setPrevias] = useState<SesionPrevia[] | null>(null);
  const [token, setToken] = useState("");
  const [ticket, setTicket] = useState<string | undefined>();
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [notas, setNotas] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const notasDirtyRef = useRef(false);

  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<"notas" | "ficha">("notas");
  const [elapsed, setElapsed] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const rtc = useWebRTC({ token, role: "psicologo", ticket });
  const recorder = useDualTrackRecorder();
  // Guarda las pistas ya detenidas para poder reintentar el envío si falla la subida
  const resultRef = useRef<Awaited<ReturnType<typeof recorder.stop>>>(null);

  // --- Carga inicial: sesión, ticket y ficha del paciente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, tRes, pRes] = await Promise.all([
          apiFetch(`/sesiones/${sesionId}/`),
          apiFetch(`/sesiones/${sesionId}/ticket_sala/`),
          apiFetch(`/pacientes/${pacienteId}/`),
        ]);
        if (cancelled) return;
        if (!sRes.ok) throw new Error("No se encontró la sesión.");
        if (tRes.status === 410) throw new Error("Esta videollamada ya fue finalizada.");
        if (!tRes.ok) throw new Error("No se pudo obtener el acceso a la sala.");
        const s: SesionSala = await sRes.json();
        const t = await tRes.json();
        setSesion(s);
        setNotas(s.notas_sesion || "");
        setToken(t.token_sala);
        setTicket(t.ticket);
        if (pRes.ok) setPaciente(await pRes.json());
        setPhase("lobby");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar la sala.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pacienteId, sesionId]);

  // Últimas 3 sesiones con sus notas (el listado no trae notas_sesion)
  useEffect(() => {
    if (phase !== "call" || previas !== null) return;
    (async () => {
      try {
        const res = await apiFetch(`/sesiones/?paciente=${pacienteId}`);
        if (!res.ok) return setPrevias([]);
        const data = await res.json();
        const list: { id: number }[] = (data.results ?? data).filter((x: { id: number }) => String(x.id) !== String(sesionId));
        const details = await Promise.all(
          list.slice(0, 3).map((x) => apiFetch(`/sesiones/${x.id}/`).then((r) => (r.ok ? r.json() : null)))
        );
        setPrevias(details.filter(Boolean));
      } catch {
        setPrevias([]);
      }
    })();
  }, [phase, previas, pacienteId, sesionId]);

  // Vista previa en el mini-lobby
  useEffect(() => {
    if (phase !== "lobby") return;
    rtc.initMedia().catch(() => setMediaError("No se pudo acceder a la cámara o micrófono. Revisa los permisos del navegador."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // La pista del paciente se (re)conecta al grabador cada vez que cambia el stream remoto
  useEffect(() => {
    recorder.attachRemote(rtc.remoteStream);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtc.remoteStream]);

  // Timer
  useEffect(() => {
    if (!recorder.recording) return;
    const started = Date.now() - elapsed * 1000;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.recording]);

  // Evitar cerrar la pestaña con la grabación en curso
  useEffect(() => {
    if (!recorder.recording) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [recorder.recording]);

  // Autosave de notas (debounce 1,5 s)
  const saveNotas = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        const res = await apiFetch(`/sesiones/${sesionId}/`, {
          method: "PATCH",
          body: JSON.stringify({ notas_sesion: value }),
        });
        setSaveState(res.ok ? "saved" : "error");
        if (res.ok) notasDirtyRef.current = false;
      } catch {
        setSaveState("error");
      }
    },
    [sesionId]
  );

  useEffect(() => {
    if (!notasDirtyRef.current) return;
    const timeout = setTimeout(() => saveNotas(notas), 1500);
    return () => clearTimeout(timeout);
  }, [notas, saveNotas]);

  async function handleEnter() {
    setMediaError(null);
    try {
      const stream = await rtc.initMedia();
      await rtc.join();
      recorder.start(stream);
      setPhase("call");
    } catch {
      setMediaError("No se pudo acceder a la cámara o micrófono.");
    }
  }

  async function handleFinish() {
    setFinishError(null);
    setPhase("finishing");
    try {
      if (!resultRef.current) resultRef.current = await recorder.stop();
      const result = resultRef.current;
      const ext = result?.mimeType.includes("mp4") ? "m4a" : result?.mimeType.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      if (result) {
        form.append("audio_psicologo", result.audioPsicologo, `psicologo.${ext}`);
        form.append("audio_paciente", result.audioPaciente, `paciente.${ext}`);
      }
      form.append("notas_sesion", notas);
      const res = await apiFetch(`/sesiones/${sesionId}/finalizar_videollamada/`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No se pudo finalizar la videollamada.");
      }
      rtc.leave();
      rtc.releaseMedia();
      setConfirmOpen(false);
      router.push(`/dashboard/pacientes/${pacienteId}/sesiones/${sesionId}`);
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Error al finalizar la videollamada.");
      setPhase("call");
    }
  }

  // --- PiP arrastrable
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  function onPipPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPipPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!dragRef.current || !stage) return;
    const s = stage.getBoundingClientRect();
    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    setPipPos({
      x: Math.min(Math.max(0, e.clientX - s.left - dragRef.current.dx), s.width - w),
      y: Math.min(Math.max(0, e.clientY - s.top - dragRef.current.dy), s.height - h),
    });
  }
  function onPipPointerUp() {
    dragRef.current = null;
  }

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center text-white">
        <AlertCircle className="h-10 w-10 text-amber-400" />
        <p className="text-sm">{error}</p>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/pacientes/${pacienteId}/sesiones/${sesionId}`)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la sesión
        </button>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-slate-950 px-4 py-8 text-white">
        <div className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div>
            <h1 className="text-lg font-semibold">Sesión virtual con {sesion?.paciente_nombre}</h1>
            <p className="text-xs text-slate-400">{sesion && formatDate(sesion.fecha_hora_inicio)}</p>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {rtc.localStream && rtc.camEnabled ? (
              <VideoView stream={rtc.localStream} muted mirrored />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">
                <VideoOff className="h-10 w-10" />
              </div>
            )}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
              <ControlButton onClick={rtc.toggleMic} active={rtc.micEnabled} title="Micrófono" disabled={!rtc.localStream}>
                {rtc.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </ControlButton>
              <ControlButton onClick={rtc.toggleCam} active={rtc.camEnabled} title="Cámara" disabled={!rtc.localStream}>
                {rtc.camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </ControlButton>
            </div>
          </div>
          <MicMeter stream={rtc.localStream} />
          <p className="text-xs text-slate-400">
            Al entrar comenzará la grabación del audio en dos pistas separadas (tu voz y la del paciente).
          </p>
          {mediaError && (
            <div className="flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{mediaError}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                rtc.releaseMedia();
                router.push(`/dashboard/pacientes/${pacienteId}/sesiones/${sesionId}`);
              }}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleEnter}
              disabled={!rtc.localStream}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              Entrar a la sala
            </button>
          </div>
        </div>
      </div>
    );
  }

  const connected = rtc.status === "connected";
  const statusText =
    rtc.status === "reconnecting"
      ? "Reconectando…"
      : rtc.status === "replaced"
        ? "Abriste esta sala en otra pestaña. Esta conexión quedó inactiva."
        : rtc.status === "unauthorized"
          ? "Acceso a la sala expirado. Recarga la página."
          : `Esperando a que ${sesion?.paciente_nombre} se conecte…`;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950 text-white">
      {/* Escenario principal */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden">
        {rtc.remoteStream && (
          <VideoView stream={rtc.remoteStream} className={cn("object-contain", !(connected && rtc.remoteMedia.cam) && "opacity-0")} />
        )}
        {(!connected || !rtc.remoteMedia.cam) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            {connected ? (
              <>
                <UserRound className="h-16 w-16 text-slate-500" />
                <p className="text-sm text-slate-300">{sesion?.paciente_nombre} tiene la cámara apagada</p>
              </>
            ) : (
              <>
                {rtc.status !== "replaced" && rtc.status !== "unauthorized" && (
                  <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                )}
                <p className="text-sm text-slate-300">{statusText}</p>
              </>
            )}
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          {recorder.recording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Grabando sesión (Audio Dual-HD)
            </span>
          )}
          <span className="rounded-full bg-black/60 px-3 py-1 font-mono text-xs">{formatElapsed(elapsed)}</span>
          {connected && !rtc.remoteMedia.mic && (
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs">
              <MicOff className="h-3.5 w-3.5" /> Paciente silenciado
            </span>
          )}
        </div>

        {/* PiP propio, arrastrable */}
        <div
          onPointerDown={onPipPointerDown}
          onPointerMove={onPipPointerMove}
          onPointerUp={onPipPointerUp}
          style={pipPos ? { left: pipPos.x, top: pipPos.y } : undefined}
          className={cn(
            "absolute h-28 w-40 cursor-move touch-none overflow-hidden rounded-xl border border-white/20 bg-black shadow-xl sm:h-36 sm:w-60",
            !pipPos && "right-3 top-3"
          )}
        >
          {rtc.camEnabled || rtc.sharingScreen ? (
            <VideoView stream={rtc.localStream} muted mirrored={!rtc.sharingScreen} />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              <VideoOff className="h-6 w-6" />
            </div>
          )}
        </div>

        {finishError && (
          <div className="absolute left-1/2 top-14 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-red-600/90 px-4 py-2 text-xs">
            <AlertCircle className="h-4 w-4" /> {finishError}
          </div>
        )}

        {/* Controles */}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-3 rounded-full bg-black/50 px-4 py-2 backdrop-blur">
          <ControlButton onClick={rtc.toggleMic} active={rtc.micEnabled} title="Micrófono">
            {rtc.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </ControlButton>
          <ControlButton onClick={rtc.toggleCam} active={rtc.camEnabled} title="Cámara">
            {rtc.camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlButton>
          <ControlButton
            onClick={rtc.sharingScreen ? rtc.stopScreenShare : rtc.startScreenShare}
            active={!rtc.sharingScreen}
            title={rtc.sharingScreen ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          >
            <MonitorUp className="h-5 w-5" />
          </ControlButton>
          <ControlButton onClick={() => setPanelOpen((v) => !v)} title={panelOpen ? "Ocultar panel" : "Mostrar panel"}>
            {panelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </ControlButton>
          <ControlButton onClick={() => setConfirmOpen(true)} danger title="Finalizar sesión">
            <PhoneOff className="h-5 w-5" />
          </ControlButton>
        </div>
      </div>

      {/* Panel lateral */}
      {panelOpen && (
        <aside className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col border-l border-white/10 bg-slate-900 md:static md:w-1/4 md:min-w-[300px] md:max-w-none">
          <div className="flex items-center border-b border-white/10">
            {(["notas", "ficha"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium",
                  tab === t ? "border-b-2 border-sky-500 text-white" : "text-slate-400 hover:text-white"
                )}
              >
                {t === "notas" ? "Notas" : "Ficha rápida"}
              </button>
            ))}
            <button type="button" onClick={() => setPanelOpen(false)} className="px-3 text-slate-400 hover:text-white md:hidden">
              <PanelRightClose className="h-5 w-5" />
            </button>
          </div>

          {tab === "notas" ? (
            <div className="flex flex-1 flex-col gap-2 p-3">
              <textarea
                value={notas}
                onChange={(e) => {
                  notasDirtyRef.current = true;
                  setNotas(e.target.value);
                }}
                placeholder="Escribe tus notas de la sesión…"
                className="flex-1 resize-none rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
              <p className="flex items-center gap-1 text-xs text-slate-400">
                {saveState === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Guardado
                  </>
                )}
                {saveState === "error" && <span className="text-red-400">No se pudo guardar; se reintentará al finalizar.</span>}
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {paciente?.riesgo_suicida && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-medium text-red-200">
                  <AlertCircle className="h-4 w-4" /> Paciente con riesgo suicida registrado
                </div>
              )}
              {[
                ["Motivo de consulta", paciente?.motivo_consulta],
                ["Diagnóstico sospechado", paciente?.diagnostico_sospechado],
                ["Medicación actual", paciente?.medicacion_actual],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="whitespace-pre-wrap text-slate-200">{value || "—"}</p>
                </div>
              ))}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Últimas sesiones</p>
                {previas === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : previas.length === 0 ? (
                  <p className="text-slate-500">Sin sesiones anteriores.</p>
                ) : (
                  <div className="space-y-2">
                    {previas.map((p) => (
                      <div key={p.id} className="rounded-xl border border-white/10 bg-slate-950 p-3">
                        <p className="text-xs text-slate-400">
                          {p.numero_sesion ? `Sesión ${p.numero_sesion} · ` : ""}
                          {formatDate(p.fecha_hora_inicio)}
                        </p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-slate-200">
                          {p.notas_sesion || "Sin notas."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Finalizar sesión"
        description="Se detendrá la grabación, se cerrará la videollamada para ambos y el audio se enviará a transcripción. ¿Deseas continuar?"
        confirmLabel="Finalizar sesión"
        confirming={phase === "finishing"}
        onConfirm={handleFinish}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
