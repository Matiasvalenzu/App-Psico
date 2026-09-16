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
  dismissForNow: () => void;
  markAsSeen: (permanently?: boolean) => Promise<void>;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModulo, setActiveModulo] = useState<number>(0);
  const [continuousPlay, setContinuousPlay] = useState<boolean>(true);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [checkedInitialState, setCheckedInitialState] = useState(false);

  // Comprobar si el usuario debe ver el onboarding inicial
  useEffect(() => {
    async function checkTutorialStatus() {
      if (typeof window === "undefined" || checkedInitialState) return;

      const localVisto = localStorage.getItem("psiconex_tutorial_visto") === "true";
      const sessionDismissed = sessionStorage.getItem("psiconex_tutorial_dismissed") === "true";

      if (localVisto || sessionDismissed) {
        setCheckedInitialState(true);
        return;
      }

      try {
        const user = await getCurrentUser();
        // Si el usuario no ha visto el tutorial según el backend
        if (user && user.tutorial_visto === false) {
          setIsOnboarding(true);
          setActiveModulo(0);
          setIsOpen(true);
        } else if (user && user.tutorial_visto === true) {
          localStorage.setItem("psiconex_tutorial_visto", "true");
        }
      } catch {
        // En caso de no estar autenticado o error en red, no forzar modal
      } finally {
        setCheckedInitialState(true);
      }
    }

    checkTutorialStatus();
  }, [checkedInitialState]);

  const openTutorial = useCallback((moduloIndex = 0) => {
    setActiveModulo(Math.max(0, Math.min(9, moduloIndex)));
    setIsOnboarding(false);
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setIsOpen(false);
    setIsOnboarding(false);
  }, []);

  const dismissForNow = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("psiconex_tutorial_dismissed", "true");
    }
    setIsOpen(false);
    setIsOnboarding(false);
  }, []);

  const markAsSeen = useCallback(async (permanently = true) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("psiconex_tutorial_visto", "true");
      sessionStorage.setItem("psiconex_tutorial_dismissed", "true");
    }
    if (permanently) {
      try {
        await apiFetch("/cuenta/perfil/", {
          method: "PATCH",
          body: JSON.stringify({ tutorial_visto: true }),
        });
      } catch (err) {
        console.error("Error al actualizar tutorial_visto en backend:", err);
      }
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
        dismissForNow,
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
