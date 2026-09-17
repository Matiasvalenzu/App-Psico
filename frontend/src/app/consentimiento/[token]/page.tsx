"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import {
  FileSignature,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Printer,
  Eraser,
  Lock,
  User,
  CreditCard,
  Building,
} from "lucide-react";

interface ConsentPayload {
  id: number;
  titulo: string;
  contenido: string;
  estado: "BORRADOR" | "ENVIADO" | "FIRMADO" | "RECHAZADO";
  paciente_nombre: string;
  paciente_rut: string;
  paciente_email: string;
  psicologo_nombre: string;
  psicologo_especialidad: string;
  fecha_envio: string | null;
  fecha_firma: string | null;
  firma_nombre: string;
  firma_rut: string;
  firma_imagen: string;
}

export default function PublicConsentimientoPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<ConsentPayload | null>(null);

  // Form state
  const [nombreFirmante, setNombreFirmante] = useState("");
  const [rutFirmante, setRutFirmante] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignatureStroke, setHasSignatureStroke] = useState(false);

  useEffect(() => {
    loadConsent();
  }, [token]);

  async function loadConsent() {
    setLoading(true);
    setError("");
    try {
      const res = await publicApiFetch(`/pacientes/consentimiento/publico/${token}/`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "El enlace no es válido o ha expirado.");
        return;
      }
      setPayload(data);
      setNombreFirmante(data.paciente_nombre || "");
      setRutFirmante(data.paciente_rut || "");
      if (data.estado === "FIRMADO") {
        setSubmitSuccess(true);
      }
    } catch {
      setError("No fue posible conectar con el servidor. Intenta nuevamente más tarde.");
    } finally {
      setLoading(false);
    }
  }

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [payload, submitSuccess]);

  // Drawing handlers (mouse and touch)
  function getCoordinates(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in event) {
      const touch = event.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignatureStroke(true);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignatureStroke(false);
  }

  async function handleSignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreFirmante.trim()) {
      setSubmitError("Por favor ingresa tu nombre completo.");
      return;
    }
    if (!rutFirmante.trim()) {
      setSubmitError("Por favor ingresa tu RUT o documento de identidad.");
      return;
    }
    if (!aceptaTerminos) {
      setSubmitError("Debes marcar la casilla aceptando los términos y condiciones.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    let firmaImagen = "";
    if (canvasRef.current && hasSignatureStroke) {
      firmaImagen = canvasRef.current.toDataURL("image/png");
    }

    try {
      const res = await publicApiFetch(`/pacientes/consentimiento/publico/${token}/firmar/`, {
        method: "POST",
        body: JSON.stringify({
          firma_nombre: nombreFirmante.trim(),
          firma_rut: rutFirmante.trim(),
          firma_imagen: firmaImagen,
          acepta_terminos: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || data.message || "No se pudo registrar la firma.");
        return;
      }
      setSubmitSuccess(true);
      if (payload) {
        setPayload({
          ...payload,
          estado: "FIRMADO",
          fecha_firma: data.fecha_firma,
          firma_nombre: data.firma_nombre,
          firma_rut: data.firma_rut,
          firma_imagen: firmaImagen || payload.firma_imagen,
        });
      }
    } catch {
      setSubmitError("Ocurrió un error al enviar tu firma. Por favor inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-sm border border-slate-200 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          <span className="text-sm font-medium">Cargando documento de consentimiento...</span>
        </div>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-sm border border-red-200 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Enlace no disponible</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{error}</p>
          <div className="mt-5 text-xs text-slate-400">
            Si crees que esto es un error, por favor contacta a tu profesional psicólogo/a.
          </div>
        </div>
      </main>
    );
  }

  const isAlreadySigned = payload.estado === "FIRMADO" || submitSuccess;

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 text-slate-900 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto">
        {/* Top Header Card */}
        <header className="bg-white rounded-2xl p-6 mb-6 shadow-xs border border-slate-200/80 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-tight text-slate-900 text-base">Psiconex</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 px-2 py-0.5 rounded-md">
                    Firma Electrónica
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consentimiento informado y resguardo ético de atención clínica
                </p>
              </div>
            </div>

            {isAlreadySigned ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Firmado Digitalmente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                <FileSignature className="h-4 w-4 text-amber-600" />
                Pendiente de Firma
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-700">Profesional Tratante:</span>{" "}
              {payload.psicologo_nombre} ({payload.psicologo_especialidad})
            </div>
            <div>
              <span className="font-semibold text-slate-700">Paciente:</span>{" "}
              {payload.paciente_nombre}
            </div>
          </div>
        </header>

        {/* Success Banner if signed */}
        {isAlreadySigned && (
          <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 shadow-xs print:hidden">
            <div className="flex items-start gap-3.5">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-700 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-emerald-900">
                  Consentimiento informado registrado exitosamente
                </h2>
                <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                  Tu firma electrónica ha sido autenticada y vinculada de forma segura a tu ficha clínica. El
                  documento cuenta con pleno resguardo de confidencialidad conforme a la Ley N° 19.628 y Ley N°
                  20.584.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-emerald-700 font-medium">
                  <span>Firmante: {payload.firma_nombre || nombreFirmante}</span>
                  <span>•</span>
                  <span>RUT: {payload.firma_rut || rutFirmante}</span>
                  {payload.fecha_firma && (
                    <>
                      <span>•</span>
                      <span>
                        Fecha: {new Date(payload.fecha_firma).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Descargar / Imprimir copia en PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Paper Container */}
        <article className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm border border-slate-200/90 leading-relaxed font-sans text-slate-800 text-sm print:shadow-none print:border-none print:p-0">
          {/* Printable Watermark/Header */}
          <div className="text-center border-b border-slate-200 pb-5 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
              <span className="font-bold tracking-tight text-slate-900 text-sm uppercase">
                Ficha de Consentimiento Informado
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
              {payload.titulo}
            </h1>
            <p className="text-xs text-slate-500 mt-1 italic">
              En conformidad a la Ley N° 19.628 sobre Protección de la Vida Privada y la Ley N° 20.584 de Derechos
              y Deberes en Salud
            </p>
          </div>

          {/* Formatted Content */}
          <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans select-text">
            {payload.contenido}
          </div>

          {/* Signatures Footer in document */}
          <div className="mt-10 pt-8 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end text-xs text-slate-700">
              {/* Patient Signature Box */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50">
                <div className="font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">
                  Firma del/de la Paciente o Representante Legal
                </div>
                {payload.firma_imagen ? (
                  <div className="my-2 bg-white rounded border border-slate-200 p-2 flex justify-center">
                    <img
                      src={payload.firma_imagen}
                      alt="Firma Digital del Paciente"
                      className="max-h-24 object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-16 flex items-center justify-center text-slate-400 italic text-[11px]">
                    {isAlreadySigned ? "Firma digital registrada" : "Espacio para firma digital"}
                  </div>
                )}
                <div className="space-y-0.5 text-[11px] text-slate-600">
                  <p>
                    <strong className="text-slate-800">Nombre:</strong> {payload.firma_nombre || payload.paciente_nombre}
                  </p>
                  <p>
                    <strong className="text-slate-800">RUT:</strong> {payload.firma_rut || payload.paciente_rut}
                  </p>
                  {payload.fecha_firma && (
                    <p>
                      <strong className="text-slate-800">Fecha:</strong>{" "}
                      {new Date(payload.fecha_firma).toLocaleString("es-CL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                  {isAlreadySigned && (
                    <p className="text-emerald-600 font-semibold pt-1">
                      ✓ Documento firmado digitalmente con consentimiento explícito.
                    </p>
                  )}
                </div>
              </div>

              {/* Professional Signature Box */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50">
                <div className="font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">
                  Profesional Psicólogo/a Tratante
                </div>
                <div className="h-16 flex items-center justify-center text-violet-700 font-serif italic text-sm">
                  {payload.psicologo_nombre}
                </div>
                <div className="space-y-0.5 text-[11px] text-slate-600">
                  <p>
                    <strong className="text-slate-800">Nombre:</strong> {payload.psicologo_nombre}
                  </p>
                  <p>
                    <strong className="text-slate-800">Especialidad:</strong> {payload.psicologo_especialidad}
                  </p>
                  <p className="text-slate-500 pt-1">
                    Emisión certificada por plataforma clínica Psiconex.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Digital Signature Form Section (shown only if not signed yet) */}
        {!isAlreadySigned && (
          <section className="mt-8 bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-violet-200 print:hidden">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-1.5 rounded-lg bg-violet-100 text-violet-700">
                <FileSignature className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Firma Digital del Consentimiento Informado
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Por favor completa tus datos y realiza tu firma en el recuadro interactivo (puedes usar tu dedo en
              pantalla táctil o el mouse) para otorgar tu consentimiento de atención psicológica.
            </p>

            <form onSubmit={handleSignSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nombre Completo del Firmante *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={nombreFirmante}
                      onChange={(e) => setNombreFirmante(e.target.value)}
                      placeholder="Ej: María González Pérez"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-9 text-xs sm:text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all"
                    />
                    <User className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Cédula de Identidad (RUT) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={rutFirmante}
                      onChange={(e) => setRutFirmante(e.target.value)}
                      placeholder="Ej: 12.345.678-9"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-9 text-xs sm:text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all font-mono"
                    />
                    <CreditCard className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>

              {/* Signature Canvas Pad */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Traza tu Firma Digital (Dedo o Mouse)
                  </label>
                  {hasSignatureStroke && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <Eraser className="h-3 w-3" />
                      Limpiar trazo
                    </button>
                  )}
                </div>
                <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-violet-400 transition-colors overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 sm:h-40 cursor-crosshair bg-white"
                  />
                  {!hasSignatureStroke && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-medium select-none">
                      Dibuja tu firma aquí con tu dedo o mouse
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tu firma quedará registrada electrónicamente con marca de tiempo, hash de seguridad y dirección IP.
                </p>
              </div>

              {/* Acceptance Checkbox */}
              <div className="rounded-xl bg-violet-50/70 border border-violet-200/80 p-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed font-medium">
                    Declaro haber leído detenidamente este Consentimiento Informado, he comprendido las condiciones
                    del proceso terapéutico, los límites de la confidencialidad y las garantías de la Ley N° 19.628,
                    y <strong>otorgo libre, previa e informadamente mi consentimiento</strong> para la atención
                    psicológica y el registro asistido seguro de las sesiones.
                  </span>
                </label>
              </div>

              {submitError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Transmisión encriptada bajo TLS 1.3 con custodia clínica</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !aceptaTerminos}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 text-sm font-bold shadow-md shadow-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Registrando firma digital..." : "Firmar y Otorgar Consentimiento"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-400 print:hidden">
          <p>© {new Date().getFullYear()} Psiconex • Plataforma Clínica Integral para Profesionales de la Salud Mental</p>
          <p className="mt-1">Respaldo de consentimiento electrónico conforme a la Ley N° 19.628 y Ley N° 20.584 de Chile.</p>
        </footer>
      </div>
    </main>
  );
}
