"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTutorial } from "@/context/TutorialContext";
import { TUTORIAL_CAPITULOS, TUTORIAL_METADATA } from "@/lib/tutorial-data";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ListVideo,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Repeat,
  Compass,
} from "lucide-react";

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function TutorialModal() {
  const {
    isOpen,
    activeModulo,
    continuousPlay,
    isOnboarding,
    closeTutorial,
    setContinuousPlay,
    setActiveModulo,
    dismissForNow,
    markAsSeen,
  } = useTutorial();

  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const chapterListRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(TUTORIAL_METADATA.duracionTotalSegundos);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mobileTab, setMobileTab] = useState<"video" | "capitulos">("video");
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquear scroll de la página al abrir el modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Manejar salto al módulo activo cuando cambia
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;
    const capitulo = TUTORIAL_CAPITULOS.find((c) => c.modulo === activeModulo);
    if (capitulo) {
      const vid = videoRef.current;
      vid.currentTime = capitulo.segundosInicio;
      vid.play().catch(() => {
        // En caso de autoplay policy
      });
      setIsPlaying(true);
    }
  }, [isOpen, activeModulo]);

  // Actualizar capítulo según el tiempo actual del video
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // Encontrar qué capítulo corresponde al tiempo actual
    let currentCapIndex = 0;
    for (let i = 0; i < TUTORIAL_CAPITULOS.length; i++) {
      if (time >= TUTORIAL_CAPITULOS[i].segundosInicio) {
        currentCapIndex = i;
      }
    }

    const currentCap = TUTORIAL_CAPITULOS[currentCapIndex];

    // Modo "Solo esta sección": detener al terminar el capítulo
    if (!continuousPlay && currentCap) {
      const finCapitulo = currentCap.segundosInicio + currentCap.duracionSegundos;
      if (time >= finCapitulo - 0.2) {
        videoRef.current.pause();
        setIsPlaying(false);
        return;
      }
    }

    if (currentCap && currentCap.modulo !== activeModulo) {
      setActiveModulo(currentCap.modulo);
    }
  }, [activeModulo, continuousPlay, setActiveModulo]);

  // Atajos de teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está en un input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const vid = videoRef.current;
      if (!vid) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeTutorial();
          break;
        case " ":
          e.preventDefault();
          if (vid.paused) {
            vid.play();
            setIsPlaying(true);
          } else {
            vid.pause();
            setIsPlaying(false);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          vid.currentTime = Math.min(vid.duration || duration, vid.currentTime + 5);
          break;
        case "m":
        case "M":
          e.preventDefault();
          vid.muted = !vid.muted;
          setIsMuted(vid.muted);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeTutorial, duration]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration || duration, videoRef.current.currentTime + seconds)
    );
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    setVolume(val);
    if (val === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const selectChapter = (modulo: number) => {
    const capitulo = TUTORIAL_CAPITULOS.find((c) => c.modulo === modulo);
    if (!capitulo || !videoRef.current) return;
    setActiveModulo(modulo);
    videoRef.current.currentTime = capitulo.segundosInicio;
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
    setMobileTab("video");
  };

  // Ocultar controles automáticamente en inactividad
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  if (!mounted || !isOpen) return null;

  const currentCapitulo =
    TUTORIAL_CAPITULOS.find((c) => c.modulo === activeModulo) || TUTORIAL_CAPITULOS[0];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeTutorial();
      }}
    >
      <div className="relative flex flex-col w-full max-w-6xl max-h-[95vh] bg-card/95 border border-border/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl transition-all">
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/70 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="tutorial-modal-title"
                  className="text-base font-bold tracking-tight text-foreground"
                >
                  Tutorial Maestro Psiconex
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/20">
                  {TUTORIAL_METADATA.duracionTotalFormateada} min
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-md hidden sm:block">
                Capítulo actual: {currentCapitulo.titulo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Continuo / Sección */}
            <button
              onClick={() => setContinuousPlay(!continuousPlay)}
              title={
                continuousPlay
                  ? "Modo Continuo: el tutorial reproduce todos los módulos"
                  : "Modo Sección: se detiene al finalizar el capítulo actual"
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                continuousPlay
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span className="hidden md:inline">
                {continuousPlay ? "Tutorial continuo" : "Solo este capítulo"}
              </span>
            </button>

            {/* Mobile View Switcher */}
            <div className="flex lg:hidden rounded-xl border border-border bg-muted/50 p-0.5">
              <button
                onClick={() => setMobileTab("video")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  mobileTab === "video"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground"
                }`}
              >
                Video
              </button>
              <button
                onClick={() => setMobileTab("capitulos")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  mobileTab === "capitulos"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground"
                }`}
              >
                Capítulos ({TUTORIAL_CAPITULOS.length})
              </button>
            </div>

            <button
              onClick={closeTutorial}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Cerrar tutorial"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Onboarding Welcome Banner ── */}
        {isOnboarding && (
          <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Compass className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs sm:text-sm text-foreground">
                <strong className="font-semibold">¡Bienvenido a Psiconex!</strong> Preparamos este
                tutorial guiado para que aproveches al máximo la ficha clínica, agenda y asistente
                IA.
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={dismissForNow}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
              >
                Ver más tarde
              </button>
              <button
                onClick={() => markAsSeen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all"
              >
                No volver a mostrar al inicio
              </button>
            </div>
          </div>
        )}

        {/* ── Main Layout: Video Player + Chapter Accordion ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Video Section (8 cols) */}
          <div
            className={`lg:col-span-8 flex flex-col bg-black relative select-none ${
              mobileTab === "capitulos" ? "hidden lg:flex" : "flex"
            }`}
            ref={playerContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            <div className="relative flex-1 flex items-center justify-center bg-black min-h-[260px] sm:min-h-[380px] md:min-h-[440px]">
              <video
                ref={videoRef}
                src={TUTORIAL_METADATA.videoUrl}
                preload="metadata"
                className="w-full h-full max-h-[65vh] object-contain cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setDuration(videoRef.current.duration || TUTORIAL_METADATA.duracionTotalSegundos);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (activeModulo < 9 && continuousPlay) {
                    selectChapter(activeModulo + 1);
                  }
                }}
                playsInline
              />

              {/* Big Play overlay when paused */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute z-20 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-2xl backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Reproducir video"
                >
                  <Play className="h-8 w-8 ml-1 fill-current" />
                </button>
              )}
            </div>

            {/* Custom Video Controls Bar */}
            <div
              className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 sm:p-4 transition-opacity duration-300 ${
                showControls || !isPlaying ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Progress Slider with Chapter ticks */}
              <div className="relative flex items-center group mb-2.5">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  aria-label="Barra de progreso del video"
                  className="w-full h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-primary group-hover:h-2.5 transition-all"
                />
              </div>

              {/* Controls buttons row */}
              <div className="flex items-center justify-between gap-2 text-white">
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 transition-colors"
                    title={isPlaying ? "Pausar (Espacio)" : "Reproducir (Espacio)"}
                  >
                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                  </button>

                  <button
                    onClick={() => seekRelative(-5)}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 transition-colors"
                    title="Retroceder 5 segundos (←)"
                  >
                    <RotateCcw className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => seekRelative(5)}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 transition-colors"
                    title="Avanzar 5 segundos (→)"
                  >
                    <RotateCw className="h-4.5 w-4.5" />
                  </button>

                  {/* Volume Control */}
                  <div className="flex items-center gap-1 group/vol ml-1">
                    <button
                      onClick={toggleMute}
                      className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                      title={isMuted ? "Activar sonido (M)" : "Silenciar (M)"}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4.5 w-4.5" />
                      ) : (
                        <Volume2 className="h-4.5 w-4.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Volumen del video"
                      className="w-14 sm:w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary group-hover/vol:h-1.5 transition-all hidden sm:block"
                    />
                  </div>

                  {/* Current Time / Total */}
                  <span className="text-xs font-mono text-white/80 ml-1">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Speed Selector */}
                  <div className="flex items-center bg-white/10 rounded-lg p-0.5">
                    {[1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changeSpeed(speed)}
                        className={`px-1.5 sm:px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                          playbackSpeed === speed
                            ? "bg-primary text-primary-foreground"
                            : "text-white/70 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 transition-colors"
                    title={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
                  >
                    {isFullscreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chapters Sidebar Section (4 cols) */}
          <div
            ref={chapterListRef}
            className={`lg:col-span-4 flex flex-col border-t lg:border-t-0 lg:border-l border-border/70 bg-card/60 overflow-hidden ${
              mobileTab === "video" ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="p-4 border-b border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListVideo className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Índice de Capítulos
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {activeModulo + 1} de {TUTORIAL_CAPITULOS.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
              {TUTORIAL_CAPITULOS.map((cap) => {
                const isActive = cap.modulo === activeModulo;
                return (
                  <button
                    key={cap.modulo}
                    onClick={() => selectChapter(cap.modulo)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start gap-3 ${
                      isActive
                        ? "bg-primary/10 border border-primary/30 shadow-xs text-foreground"
                        : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-transform group-hover:scale-105 ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-accent"
                      }`}
                    >
                      {cap.modulo}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs font-semibold truncate ${
                            isActive ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {cap.titulo}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                          {cap.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {cap.descripcion}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80 bg-muted/70 px-2 py-0.5 rounded-md">
                          <Layers className="h-2.5 w-2.5" />
                          <span className="truncate max-w-[160px]">{cap.pantallaAsociada}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          • {Math.round(cap.duracionSegundos)}s
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-border/70 bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                11m 16s total
              </span>
              <button
                onClick={() => markAsSeen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marcar como visto
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
