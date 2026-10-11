"use client";

import { useState } from "react";
import { Download, Eye, Loader2, MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cleanMarkdownEmphasis,
  downloadResponse,
  getInformeTipoLabel,
  safeFilename,
  type InformeIA,
} from "./utils";

// Informes guardados desde el asistente IA: lista, visor, descarga y eliminación.
export default function InformesIA({
  informes,
  onDeleted,
}: {
  informes: InformeIA[];
  onDeleted: (id: number) => void;
}) {
  const [selected, setSelected] = useState<InformeIA | null>(null);
  const [toDelete, setToDelete] = useState<InformeIA | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(informe: InformeIA, format: "pdf" | "docx") {
    setDownloading(`${informe.id}-${format}`);
    try {
      const endpoint = format === "pdf" ? "exportar_pdf" : "exportar_docx";
      const res = await apiFetch(`/chat/informes/${informe.id}/${endpoint}/`);
      if (!res.ok) throw new Error();
      await downloadResponse(res, `${safeFilename(informe.titulo || getInformeTipoLabel(informe.tipo))}.${format}`);
    } catch {
      toast.error(`No se pudo descargar el informe en ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/chat/informes/${toDelete.id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(toDelete.id);
      if (selected?.id === toDelete.id) setSelected(null);
      setToDelete(null);
      toast.success("Informe IA eliminado correctamente.");
    } catch {
      setDeleteError("No se pudo eliminar el informe IA.");
    } finally {
      setDeleting(false);
    }
  }

  const titulo = (informe: InformeIA) => informe.titulo || getInformeTipoLabel(informe.tipo);

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Informes IA guardados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Respuestas clínicas del asistente guardadas como documentos del paciente.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {informes.length} informe{informes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {informes.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no hay informes guardados. Guarda una respuesta del chat IA para conservarla como informe clínico.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {informes.map((informe) => (
            <li key={informe.id} className="flex flex-col rounded-xl border border-border/60 p-4">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(informe)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{titulo(informe)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {getInformeTipoLabel(informe.tipo)} · {formatDate(informe.created_at)}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 -mt-1.5" aria-label={`Acciones de ${titulo(informe)}`}>
                      {downloading?.startsWith(`${informe.id}-`) ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => setSelected(informe)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Abrir
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => download(informe, "pdf")}>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => download(informe, "docx")}>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar Word
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => {
                        setDeleteError("");
                        setToDelete(informe);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {cleanMarkdownEmphasis(informe.contenido)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          {selected && (
            <>
              <DialogHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {getInformeTipoLabel(selected.tipo)}
                </p>
                <DialogTitle className="break-words">{titulo(selected)}</DialogTitle>
                <DialogDescription>Generado el {formatDate(selected.created_at)}</DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-wrap border-y border-border/60 py-4 text-sm leading-relaxed">
                {cleanMarkdownEmphasis(selected.contenido)}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => download(selected, "pdf")} disabled={downloading === `${selected.id}-pdf`}>
                  {downloading === `${selected.id}-pdf` ? <Loader2 className="animate-spin" /> : <Download />}
                  Descargar PDF
                </Button>
                <Button variant="outline" onClick={() => download(selected, "docx")} disabled={downloading === `${selected.id}-docx`}>
                  {downloading === `${selected.id}-docx` ? <Loader2 className="animate-spin" /> : <Download />}
                  Descargar Word
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:order-first sm:mr-auto"
                  onClick={() => {
                    setDeleteError("");
                    setToDelete(selected);
                  }}
                >
                  <Trash2 />
                  Eliminar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar informe IA"
        description={toDelete ? `Se eliminará permanentemente el informe "${titulo(toDelete)}".` : ""}
        confirmLabel="Eliminar informe"
        confirming={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
