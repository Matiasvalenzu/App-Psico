"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquarePlus } from "lucide-react";
import FeedbackForm from "./FeedbackForm";

interface QuickFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickFeedbackModal({
  isOpen,
  onClose,
}: QuickFeedbackModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquear scroll del fondo cuando el modal está abierto
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

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Enviar Feedback o Reportar Error
              </h2>
              <p className="text-xs text-muted-foreground">
                Ayúdanos a mejorar tu experiencia en Psiconex
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body with scroll */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <FeedbackForm
            compact={true}
            onSuccess={() => {
              setTimeout(() => {
                onClose();
              }, 1800);
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
