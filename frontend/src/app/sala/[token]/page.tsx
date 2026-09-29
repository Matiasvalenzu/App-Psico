"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, AlertCircle, CheckCircle2, UserRound } from "lucide-react";
import { publicApiFetch } from "@/lib/api";
import { Logo } from "@/components/brand/logo";
import { useWebRTC } from "@/hooks/useWebRTC";
import { ControlButton, MicMeter, VideoView } from "@/components/sesion/SalaMedia";

interface SalaInfo {
  valida: boolean;
  sesion_id: number;
  paciente_nombre: string;
  psicologo_nombre: string;
  estado_videollamada: string;
}

type Phase = "loading" | "invalid" | "finished" | "lobby" | "call" | "ended";

function FullMessage({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-center text-white">
      <div className="rounded-lg bg-white px-4 py-2">
        <Logo />
      </div>
      <div className="flex flex-col items-center gap-3 max-w-md">
        {icon}
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-300">{text}</p>
      </div>
    </div>
  );
}

export default function SalaPacientePage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<SalaInfo | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const wasConnectedRef = useRef(false);

  const rtc = useWebRTC({ token, role: "paciente" });

  async function checkSala(): Promise<number> {
    try {
      const res = await publicApiFetch(`/sesiones/sala/${token}/`);
      if (res.ok) setInfo(await res.json());
      return res.status;
    } catch {
      return 0;
    }
  }

  useEffect(() => {
    checkSala().then((code) => {
      if (code === 200) setPhase("lobby");
      else if (code === 410) setPhase("finished");
      else setPhase("invalid");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Vista previa de cámara y micrófono en el lobby
  useEffect(() => {
    if (phase !== "lobby") return;
    rtc.initMedia().catch(() =>
      setMediaError(
        "No pudimos acceder a tu cámara o micrófono. Revisa los permisos del navegador (ícono del candado junto a la dirección) y recarga la página."
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (rtc.status === "connected") wasConnectedRef.current = true;
  }, [rtc.status]);

  // Si el profesional se desconecta, verificar si la sesión fue finalizada
  useEffect(() => {
    if (phase !== "call" || rtc.status !== "waiting" || !wasConnectedRef.current) return;
    const interval = setInterval(async () => {
      if ((await checkSala()) === 410) {
        rtc.leave();
        rtc.releaseMedia();
        setPhase("ended");
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, rtc.status]);

  async function handleJoin() {
    setJoining(true);
    try {
      await rtc.join();
      setPhase("call");
    } catch {
      setMediaError("No pudimos acceder a tu cámara o micrófono.");
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    rtc.leave();
    rtc.releaseMedia();
    setPhase("ended");
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (phase === "invalid") {
    return (
      <FullMessage
        icon={<AlertCircle className="h-10 w-10 text-amber-400" />}
        title="Enlace no válido"
        text="Este enlace de videollamada no existe o fue escrito de forma incorrecta. Pídele a tu profesional que te lo reenvíe."
      />
    );
  }
  if (phase === "finished") {
    return (
      <FullMessage
        icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
        title="Esta sesión ya finalizó"
        text="La videollamada asociada a este enlace terminó. Si necesitas una nueva sesión, contacta a tu profesional."
      />
    );
  }
  if (phase === "ended") {
    return (
      <FullMessage
        icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
        title="La sesión ha terminado"
        text="Gracias por conectarte. Ya puedes cerrar esta ventana."
      />
    );
  }
  if (rtc.status === "room-full") {
    return (
      <FullMessage
        icon={<AlertCircle className="h-10 w-10 text-amber-400" />}
        title="La sala está ocupada"
        text="Ya hay otra persona conectada como paciente en esta sesión. Si fuiste tú desde otro dispositivo, cierra esa ventana y recarga esta página."
      />
    );
  }

  if (phase === "lobby") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-8 text-white">
        <div className="rounded-lg bg-white px-4 py-2">
          <Logo />
        </div>
        <div className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-center">
            <h1 className="text-lg font-semibold">Hola{info?.paciente_nombre ? `, ${info.paciente_nombre}` : ""}</h1>
            <p className="text-sm text-slate-300">
              Tu sesión con <strong>{info?.psicologo_nombre}</strong> está por comenzar.
            </p>
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
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Nivel del micrófono (habla para probarlo)</p>
            <MicMeter stream={rtc.localStream} />
          </div>
          {mediaError && (
            <div className="flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{mediaError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleJoin}
            disabled={!rtc.localStream || joining}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            {joining && <Loader2 className="h-4 w-4 animate-spin" />}
            Unirse a la sesión
          </button>
          <p className="text-center text-xs text-slate-400">
            Te recomendamos usar audífonos y estar en un lugar tranquilo y privado.
          </p>
        </div>
      </div>
    );
  }

  const connected = rtc.status === "connected";
  return (
    <div className="fixed inset-0 bg-slate-950 text-white">
      <div className="absolute inset-0">
        {rtc.remoteStream && <VideoView stream={rtc.remoteStream} className={connected && rtc.remoteMedia.cam ? "" : "opacity-0"} />}
        {(!connected || !rtc.remoteMedia.cam) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            {connected ? (
              <>
                <UserRound className="h-16 w-16 text-slate-500" />
                <p className="text-sm text-slate-300">{info?.psicologo_nombre} tiene la cámara apagada</p>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                <p className="text-sm text-slate-300">
                  {rtc.status === "reconnecting"
                    ? "Reconectando…"
                    : wasConnectedRef.current
                      ? `${info?.psicologo_nombre} se desconectó. Esperando a que vuelva…`
                      : `Esperando a que ${info?.psicologo_nombre} inicie la sesión…`}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3 h-28 w-20 overflow-hidden rounded-xl border border-white/20 bg-black shadow-xl sm:h-36 sm:w-52">
        {rtc.camEnabled ? (
          <VideoView stream={rtc.localStream} muted mirrored />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <VideoOff className="h-6 w-6" />
          </div>
        )}
      </div>

      {connected && !rtc.remoteMedia.mic && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs">
          <MicOff className="h-3.5 w-3.5" /> Micrófono del profesional silenciado
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-3 rounded-full bg-black/50 px-4 py-2 backdrop-blur">
        <ControlButton onClick={rtc.toggleMic} active={rtc.micEnabled} title="Micrófono">
          {rtc.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton onClick={rtc.toggleCam} active={rtc.camEnabled} title="Cámara">
          {rtc.camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton onClick={handleLeave} danger title="Salir de la sesión">
          <PhoneOff className="h-5 w-5" />
        </ControlButton>
      </div>
    </div>
  );
}
