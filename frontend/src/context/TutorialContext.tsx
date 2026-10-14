"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { tutorialForPath, type TutorialSlug } from "@/lib/tutorial-data";

export type TutorialView =
  | { kind: "closed" }
  | { kind: "welcome" }
  | { kind: "prompt"; slug: TutorialSlug }
  | { kind: "player"; slug: TutorialSlug }
  | { kind: "catalog" };

interface TutorialContextType {
  view: TutorialView;
  openTutorial: (slug?: TutorialSlug) => void;
  openCatalog: () => void;
  dismissPrompt: (persist: boolean) => void;
  rememberPrompt: () => void;
  closeOverlay: () => void;
  setSectionHint: (slug: TutorialSlug | null) => void;
}

function storageKey(userKey: string) {
  return `psiconex-tutoriales:${userKey}`;
}

function readLocal(userKey: string): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userKey)) || "{}");
    if (!raw || typeof raw !== "object") return {};
    const seen: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value) seen[key] = true;
    }
    return seen;
  } catch {
    return {};
  }
}

function mergeSeen(remote: Record<string, boolean>, local: Record<string, boolean>) {
  const seen: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(local)) if (value) seen[key] = true;
  for (const [key, value] of Object.entries(remote)) if (value) seen[key] = true;
  return seen;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [view, setView] = useState<TutorialView>({ kind: "closed" });
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [sectionHint, setSectionHintState] = useState<TutorialSlug | null>(null);
  const seenRef = useRef<Record<string, boolean>>({});
  const userKeyRef = useRef<string | null>(null);
  const skippedRef = useRef(new Set<string>());
  const hintRef = useRef<TutorialSlug | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const setSectionHint = useCallback((slug: TutorialSlug | null) => {
    hintRef.current = slug;
    setSectionHintState(slug);
  }, []);

  const persistSeen = useCallback(async (slug: string) => {
    const next = { ...seenRef.current, [slug]: true };
    seenRef.current = next;
    setSeen(next);
    const userKey = userKeyRef.current;
    if (userKey) {
      try {
        localStorage.setItem(storageKey(userKey), JSON.stringify(next));
      } catch {
        // El backend sigue siendo la fuente de verdad.
      }
    }
    const body: Record<string, unknown> = { tutoriales_vistos: { [slug]: true } };
    if (slug === "bienvenida") body.tutorial_visto = true;
    try {
      await apiFetch("/cuenta/perfil/", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("No se pudo guardar el tutorial visto:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        const userKey = String(user.id ?? user.username ?? "anon");
        userKeyRef.current = userKey;
        const remote: Record<string, boolean> = {};
        const fromApi = user.tutoriales_vistos;
        if (fromApi && typeof fromApi === "object") {
          for (const [key, value] of Object.entries(fromApi)) {
            if (value) remote[key] = true;
          }
        }
        if (user.tutorial_visto) remote.bienvenida = true;
        const merged = mergeSeen(remote, readLocal(userKey));
        seenRef.current = merged;
        setSeen(merged);
        if (!merged.bienvenida) {
          setView({ kind: "welcome" });
          void persistSeen("bienvenida");
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [persistSeen]);

  useEffect(() => {
    if (!ready || view.kind !== "closed") return;
    const slug = sectionHint ?? tutorialForPath(pathname);
    if (!slug || seen[slug] || skippedRef.current.has(slug)) return;
    const timer = window.setTimeout(() => {
      setView({ kind: "prompt", slug });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [ready, pathname, sectionHint, seen, view]);

  const resolveCurrent = useCallback((): TutorialSlug => {
    return hintRef.current ?? tutorialForPath(pathnameRef.current) ?? "bienvenida";
  }, []);

  const openTutorial = useCallback((slug?: TutorialSlug) => {
    const target = slug ?? resolveCurrent();
    skippedRef.current.add(target);
    setView({ kind: "player", slug: target });
  }, [resolveCurrent]);

  const openCatalog = useCallback(() => {
    setView({ kind: "catalog" });
  }, []);

  const dismissPrompt = useCallback((persist: boolean) => {
    setView((current) => {
      if (current.kind !== "prompt") return current;
      if (persist) void persistSeen(current.slug);
      else skippedRef.current.add(current.slug);
      return { kind: "closed" };
    });
  }, [persistSeen]);

  const rememberPrompt = useCallback(() => {
    setView((current) => {
      if (current.kind === "prompt") void persistSeen(current.slug);
      return current;
    });
  }, [persistSeen]);

  const closeOverlay = useCallback(() => {
    setView({ kind: "closed" });
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        view,
        openTutorial,
        openCatalog,
        dismissPrompt,
        rememberPrompt,
        closeOverlay,
        setSectionHint,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial debe usarse dentro de un TutorialProvider");
  }
  return context;
}

export function useTutorialSection(slug: TutorialSlug | null) {
  const { setSectionHint } = useTutorial();
  useEffect(() => {
    setSectionHint(slug);
    return () => setSectionHint(null);
  }, [slug, setSectionHint]);
}
