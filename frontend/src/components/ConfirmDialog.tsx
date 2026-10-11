"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirming?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirming = false,
  error = "",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirming) onCancel();
      }}
    >
      <AlertDialog.Portal>
        {/* z alto: puede abrirse sobre modales que aún usan z-[9999] */}
        <AlertDialog.Backdrop className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[10000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/70 bg-card p-6 text-card-foreground shadow-elevated outline-none transition-all duration-150 data-[starting-style]:scale-95 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <AlertDialog.Title className="text-lg font-semibold tracking-tight">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </AlertDialog.Description>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={confirming}>
              {cancelLabel}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={confirming}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirming ? "Eliminando..." : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
