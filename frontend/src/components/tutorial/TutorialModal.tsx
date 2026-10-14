"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, PlayCircle, X } from "lucide-react";
import { useTutorial } from "@/context/TutorialContext";
import { TUTORIALES, tutorialPorSlug } from "@/lib/tutorial-data";

function TutorialVideo({
  src,
  videoRef,
}: {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  return (
    <video
      key={src}
      ref={videoRef}
      src={src}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-lg bg-black"
    />
  );
}

export default function TutorialModal() {
  const { view, openTutorial, dismissPrompt, rememberPrompt, closeOverlay } = useTutorial();
  const [mounted, setMounted] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const promptSlug = view.kind === "prompt" ? view.slug : view.kind === "welcome" ? "bienvenida" : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDontShow(false);
  }, [promptSlug]);

  useEffect(() => {
    if (view.kind === "closed") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (view.kind === "prompt") dismissPrompt(dontShow);
      else closeOverlay();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view, dontShow, dismissPrompt, closeOverlay]);

  useEffect(() => {
    if (view.kind !== "prompt") return;
    const onPointer = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        dismissPrompt(dontShow);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [view, dontShow, dismissPrompt]);

  if (!mounted || view.kind === "closed") return null;

  const play = () => {
    videoRef.current?.play().catch(() => {});
  };

  if (view.kind === "catalog") {
    return createPortal(
      <div
        className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/35 p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeOverlay();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-catalogo-titulo"
          className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <h2 id="tutorial-catalogo-titulo" className="text-sm font-semibold">
              Video Tutorial
            </h2>
            <button
              type="button"
              onClick={closeOverlay}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Cerrar tutoriales"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto p-2">
            {TUTORIALES.map((video) => (
              <button
                key={video.slug}
                type="button"
                onClick={() => openTutorial(video.slug)}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/80"
              >
                <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{video.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{video.descripcion}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const video = tutorialPorSlug(view.kind === "player" || view.kind === "prompt" || view.kind === "welcome" ? view.kind === "welcome" ? "bienvenida" : view.slug : null);
  if (!video) return null;

  if (view.kind === "prompt") {
    return createPortal(
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-prompt-titulo"
        className="fixed bottom-4 right-4 z-[100000] w-[min(100%-2rem,22rem)] rounded-2xl border border-border/80 bg-card p-3 shadow-2xl"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Tutorial</p>
            <h2 id="tutorial-prompt-titulo" className="text-sm font-semibold leading-snug">
              {video.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dismissPrompt(dontShow)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <TutorialVideo src={video.archivo} videoRef={videoRef} />
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(event) => {
              const checked = event.target.checked;
              setDontShow(checked);
              if (checked) rememberPrompt();
            }}
            className="h-3.5 w-3.5 accent-primary"
          />
          No volver a mostrar
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dismissPrompt(dontShow)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={play}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Ver tutorial
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  const esBienvenida = view.kind === "welcome";
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-player-titulo"
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          if (esBienvenida) closeOverlay();
          else closeOverlay();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="tutorial-player-titulo" className="text-base font-semibold">
              {video.titulo}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{video.descripcion}</p>
          </div>
          <button
            type="button"
            onClick={closeOverlay}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <TutorialVideo src={video.archivo} videoRef={videoRef} />
          <button
            type="button"
            onClick={play}
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {esBienvenida ? "Ver tutorial" : "Reproducir"}
          </button>
        </div>
        {esBienvenida && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={closeOverlay}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
