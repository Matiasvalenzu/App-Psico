"use client";

import React, { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import QuickFeedbackModal from "./QuickFeedbackModal";

export default function FloatingFeedbackButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 flex items-center gap-2 group">
        {!minimized ? (
          <div className="flex items-center gap-1.5 rounded-full bg-card/95 pl-3.5 pr-1.5 py-1.5 shadow-lg border border-border/80 backdrop-blur transition-all duration-300 hover:shadow-xl hover:border-primary/40">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </div>
              <span>¿Feedback o Error?</span>
            </button>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="p-1 text-muted-foreground/60 hover:text-foreground rounded-full transition hover:bg-accent"
              title="Minimizar botón"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMinimized(false);
            }}
            title="Enviar feedback o reportar error (Clic derecho para expandir)"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        )}
      </div>

      <QuickFeedbackModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
