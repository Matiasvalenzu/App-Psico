"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Sesion } from "./utils";

// Confirmación compartida para eliminar sesiones, tests y documentos externos.
export default function DeleteSesionDialog({
  sesion,
  onClose,
  onDeleted,
}: {
  sesion: Sesion | null;
  onClose: () => void;
  onDeleted: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sesion) setError("");
  }, [sesion]);

  const isDocument = sesion?.origen === "DOCUMENTO_EXTERNO";
  const isTest = sesion?.origen === "TEST_PSICOLOGICO";
  const tipo = isDocument ? "documento externo" : isTest ? "test psicológico" : "sesión";

  const description = !sesion
    ? ""
    : isDocument
    ? `Esta acción eliminará permanentemente el documento ${
        sesion.documento_nombre_original || `externo del ${formatDate(sesion.fecha_hora_inicio)}`
      }. No se puede deshacer.`
    : isTest
    ? `Esta acción eliminará permanentemente el resultado del test ${
        sesion.documento_nombre_original || "psicológico"
      }. No se puede deshacer.`
    : `Esta acción eliminará permanentemente la sesión del ${formatDate(sesion.fecha_hora_inicio)} a las ${formatTime(
        sesion.fecha_hora_inicio
      )}. No se puede deshacer.`;

  const handleConfirm = async () => {
    if (!sesion) return;
    setDeleting(true);
    setError("");
    try {
      const res = await apiFetch(`/sesiones/${sesion.id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(sesion.id);
      toast.success(`${tipo.charAt(0).toUpperCase()}${tipo.slice(1)} eliminado${isDocument || isTest ? "" : "a"}.`);
      onClose();
    } catch {
      setError(
        `No se pudo eliminar ${isDocument ? "el documento" : isTest ? "el test" : "la sesión"}. Inténtalo nuevamente.`
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(sesion)}
      title={`Eliminar ${tipo}`}
      description={description}
      confirmLabel="Eliminar"
      confirming={deleting}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
