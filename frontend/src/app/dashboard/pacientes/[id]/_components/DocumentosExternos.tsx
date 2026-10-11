"use client";

import { useState } from "react";
import { Download, Eye, FileText, Loader2, MoreHorizontal, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadResponse,
  getApiErrorMessage,
  getDateTimeInputValue,
  safeFilename,
  type DocumentoExternoDetalle,
  type Sesion,
} from "./utils";

// Documentos cargados como contexto del paciente: subida, visor, descarga y eliminación.
export default function DocumentosExternos({
  pacienteId,
  documentos,
  onUploaded,
  onDelete,
}: {
  pacienteId: string;
  documentos: Sesion[];
  onUploaded: () => Promise<void> | void;
  onDelete: (documento: Sesion) => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [selected, setSelected] = useState<DocumentoExternoDetalle | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  function openUpload() {
    setDateTime(getDateTimeInputValue());
    setFile(null);
    setUploadError("");
    setUploadOpen(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError("");
    if (!file) {
      setUploadError("Selecciona un archivo TXT, DOCX o PDF.");
      return;
    }
    if (!dateTime) {
      setUploadError("Selecciona fecha y hora para el documento.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("paciente", pacienteId);
      formData.append("fecha_hora_inicio", new Date(dateTime).toISOString());
      formData.append("archivo", file);
      const res = await apiFetch("/sesiones/upload_documento/", { method: "POST", body: formData });
      if (!res.ok) {
        let message = "No se pudo cargar el documento.";
        try {
          message = getApiErrorMessage(await res.json(), message);
        } catch {}
        setUploadError(message);
        return;
      }
      setUploadOpen(false);
      setFile(null);
      toast.success("Documento cargado.");
      await onUploaded();
    } catch (err) {
      console.error(err);
      setUploadError("No se pudo cargar el documento.");
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(documento: Sesion) {
    setOpeningId(documento.id);
    try {
      const res = await apiFetch(`/sesiones/${documento.id}/`);
      if (!res.ok) throw new Error();
      setSelected(await res.json());
    } catch {
      toast.error("No se pudo abrir el documento externo.");
    } finally {
      setOpeningId(null);
    }
  }

  async function download(documento: Sesion, format: "pdf" | "docx") {
    setDownloading(`${documento.id}-${format}`);
    try {
      const endpoint = format === "pdf" ? "exportar_pdf" : "exportar_docx";
      const res = await apiFetch(`/sesiones/${documento.id}/${endpoint}/`);
      if (!res.ok) throw new Error();
      const base = documento.documento_nombre_original || `documento-${documento.id}`;
      await downloadResponse(res, `${safeFilename(base.replace(/\.[^.]+$/, ""))}.${format}`);
    } catch {
      toast.error(`No se pudo descargar el documento en ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            Documentos externos <span className="font-normal text-muted-foreground">({documentos.length})</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Archivos cargados como contexto del paciente, separados de las sesiones clínicas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openUpload}>
          <Upload />
          Cargar documento
        </Button>
      </div>

      {documentos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no hay documentos externos.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
          {documentos.map((documento) => (
            <li key={documento.id} className="flex items-center gap-2 pr-2 transition-colors hover:bg-muted/40">
              <button
                type="button"
                onClick={() => openDocument(documento)}
                className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                  {openingId === documento.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {documento.documento_nombre_original || "Documento externo"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(documento.fecha_hora_inicio)}</span>
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Acciones del documento">
                    {downloading?.startsWith(`${documento.id}-`) ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => openDocument(documento)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Abrir
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => download(documento, "pdf")}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => download(documento, "docx")}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Word
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => onDelete(documento)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={uploadOpen} onOpenChange={(open) => !uploading && setUploadOpen(open)}>
        <DialogContent>
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Cargar documento externo</DialogTitle>
              <DialogDescription>Se guardará como documento externo, separado de las sesiones clínicas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="documento-fecha">Fecha y hora</Label>
              <Input
                id="documento-fecha"
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documento-archivo">Archivo</Label>
              <Input
                id="documento-archivo"
                type="file"
                accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                aria-describedby="documento-archivo-ayuda"
              />
              <p id="documento-archivo-ayuda" className="text-xs text-muted-foreground">
                Formatos permitidos: TXT, DOCX y PDF con texto seleccionable.
              </p>
            </div>
            {uploadError && (
              <Alert variant="destructive">
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="animate-spin" />}
                {uploading ? "Cargando..." : "Cargar documento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          {selected && (
            <>
              <DialogHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documento externo</p>
                <DialogTitle className="break-words">
                  {selected.documento_nombre_original || "Documento externo"}
                </DialogTitle>
                <DialogDescription>Cargado el {formatDate(selected.fecha_hora_inicio)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 border-y border-border/60 py-4">
                {selected.segmentos?.length ? (
                  selected.segmentos.map((segmento) => (
                    <div key={segmento.id}>
                      <p className="text-xs font-medium text-muted-foreground">Parte {segmento.orden}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{segmento.texto}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Documento sin contenido extraído.</p>
                )}
              </div>
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
                    onDelete(selected);
                    setSelected(null);
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
    </section>
  );
}
