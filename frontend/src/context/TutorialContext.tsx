"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch, getCurrentUser } from "@/lib/api";

interface TutorialContextType {
  isOpen: boolean;
  activeModulo: number;
  continuousPlay: boolean;
  isOnboarding: boolean;
  openTutorial: (moduloIndex?: number) => void;
  closeTutorial: () => void;
  setContinuousPlay: (continuous: boolean) => void;
  setActiveModulo: (modulo: number) => void;
  markAsSeen: () => Promise<void>;
}

function persistTutorialVisto() {
  return apiFetch("/cuenta/perfil/", {
    method: "PATCH",
    body: JSON.stringify({ tutorial_visto: true }),
  });
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModulo, setActiveModulo] = useState<number>(0);
  const [continuousPlay, setContinuousPlay] = useState<boolean>(true);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);

  // El onboarding se abre solo la primera vez que la cuenta entra: el flag vive en
  // el backend (por cuenta) y se marca apenas se muestra, sin importar cómo se cierre.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (cancelled || user?.tutorial_visto !== false) return;
        setIsOnboarding(true);
        setActiveModulo(0);
        setIsOpen(true);
        persistTutorialVisto().catch((err) => {
          console.error("Error al actualizar tutorial_visto en backend:", err);
        });
      })
      .catch(() => {
        // Sin sesión o error de red: no forzar el modal
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTutorial = useCallback((moduloIndex = 0) => {
    setActiveModulo(Math.max(0, Math.min(9, moduloIndex)));
    setIsOnboarding(false);
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setIsOpen(false);
    setIsOnboarding(false);
  }, []);

  const markAsSeen = useCallback(async () => {
    try {
      await persistTutorialVisto();
    } catch (err) {
      console.error("Error al actualizar tutorial_visto en backend:", err);
    }
    setIsOpen(false);
    setIsOnboarding(false);
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        isOpen,
        activeModulo,
        continuousPlay,
        isOnboarding,
        openTutorial,
        closeTutorial,
        setContinuousPlay,
        setActiveModulo,
        markAsSeen,
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
