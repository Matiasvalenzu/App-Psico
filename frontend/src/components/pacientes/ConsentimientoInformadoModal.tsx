"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileSignature,
  Printer,
  Download,
  Copy,
  Check,
  RotateCcw,
  Save,
  X,
  ShieldCheck,
  FileText,
  Sliders,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiFetch, getCurrentUser } from "@/lib/api";

interface PacienteData {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  rut?: string;
  edad?: number | null;
  telefono_whatsapp?: string;
  email_contacto?: string;
  direccion?: string;
  comuna?: string;
  es_menor_edad?: boolean;
  nombre_tutor?: string;
  telefono_tutor?: string;
}

interface ConsentimientoModalProps {
  isOpen: boolean;
  onClose: () => void;
  paciente: PacienteData;
  onSavedToFicha?: () => void;
}

interface PsychologistProfile {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  rut_profesional?: string;
  registro_profesional?: string;
  especialidad_clinica?: string;
  telefono_profesional?: string;
  comuna?: string;
  direccion_consulta?: string;
}

function formatDateSpanish(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    const months = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  }
}

export default function ConsentimientoInformadoModal({
  isOpen,
  onClose,
  paciente,
  onSavedToFicha,
}: ConsentimientoModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "edit" | "params">("preview");
  const [loadingUser, setLoadingUser] = useState(false);
  const [savingInforme, setSavingInforme] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Editable parameters
  const [ciudad, setCiudad] = useState("Santiago");
  const [fecha, setFecha] = useState(formatDateSpanish());
  const [psicologoNombre, setPsicologoNombre] = useState("");
  const [psicologoRut, setPsicologoRut] = useState("");
  const [psicologoRegistro, setPsicologoRegistro] = useState("");
  const [psicologoEspecialidad, setPsicologoEspecialidad] = useState("Psicología Clínica");
  const [psicologoLugar, setPsicologoLugar] = useState("");

  // Paciente editable params
  const [pacienteNombre, setPacienteNombre] = useState(paciente.nombre_completo || "");
  const [pacienteRut, setPacienteRut] = useState(paciente.rut || "");
  const [pacienteEdad, setPacienteEdad] = useState(paciente.edad ? `${paciente.edad} años` : "");
  const [pacienteDomicilio, setPacienteDomicilio] = useState(
    [paciente.direccion, paciente.comuna].filter(Boolean).join(", ") || ""
  );
  const [pacienteContacto, setPacienteContacto] = useState(
    [paciente.telefono_whatsapp, paciente.email_contacto].filter(Boolean).join(" / ") || ""
  );

  // Tutor params
  const [esMenor, setEsMenor] = useState(Boolean(paciente.es_menor_edad));
  const [tutorNombre, setTutorNombre] = useState(paciente.nombre_tutor || "");
  const [tutorTelefono, setTutorTelefono] = useState(paciente.telefono_tutor || "");

  // Options
  const [incluirGrabacion, setIncluirGrabacion] = useState(true);
  const [acuerdosAdicionales, setAcuerdosAdicionales] = useState("");

  // Raw full editable text
  const [documentContent, setDocumentContent] = useState("");
  const [hasManuallyEdited, setHasManuallyEdited] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch current psychologist profile
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    async function loadPsicologo() {
      setLoadingUser(true);
      try {
        const profile: PsychologistProfile = await getCurrentUser();
        if (isCancelled) return;
        const nombre =
          profile.full_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "";
        if (nombre) setPsicologoNombre(nombre);
        if (profile.rut_profesional) setPsicologoRut(profile.rut_profesional);
        if (profile.registro_profesional) setPsicologoRegistro(profile.registro_profesional);
        if (profile.especialidad_clinica) setPsicologoEspecialidad(profile.especialidad_clinica);
        if (profile.direccion_consulta || profile.comuna) {
          setPsicologoLugar(
            [profile.direccion_consulta, profile.comuna].filter(Boolean).join(", ")
          );
        }
        if (profile.comuna) {
          setCiudad(profile.comuna);
        }
      } catch (err) {
        console.warn("No se pudo cargar el perfil del psicólogo automáticamente:", err);
      } finally {
        if (!isCancelled) setLoadingUser(false);
      }
    }
    loadPsicologo();
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Function to build template text
  const buildTemplate = useMemo(() => {
    return () => {
      const pNombre = psicologoNombre.trim() || "[Nombre del/de la Profesional]";
      const pRut = psicologoRut.trim() || "[RUT del Profesional]";
      const pReg = psicologoRegistro.trim() || "[N° Registro SIS / Profesional]";
      const pEsp = psicologoEspecialidad.trim() || "Psicología Clínica";
      const pLugar = psicologoLugar.trim() || "Consulta profesional / Atención remota";

      const pacNom = pacienteNombre.trim() || paciente.nombre_completo || "[Nombre del Paciente]";
      const pacR = pacienteRut.trim() || paciente.rut || "[RUT del Paciente]";
      const pacEd = pacienteEdad.trim() || (paciente.edad ? `${paciente.edad} años` : "[Edad]");
      const pacDom =
        pacienteDomicilio.trim() ||
        [paciente.direccion, paciente.comuna].filter(Boolean).join(", ") ||
        "[Domicilio no especificado]";
      const pacCont =
        pacienteContacto.trim() ||
        [paciente.telefono_whatsapp, paciente.email_contacto].filter(Boolean).join(" / ") ||
        "[Contacto no especificado]";

      let tutorSection = "";
      if (esMenor) {
        tutorSection = `\n- Representante Legal / Tutor/a: ${tutorNombre || "[Nombre del Tutor/a]"}
- Teléfono de Contacto del Tutor/a: ${tutorTelefono || "[Teléfono del Tutor/a]"}
- Calidad: Padre / Madre / Representante legal acreditado`;
      }

      let grabacionSection = "";
      if (incluirGrabacion) {
        grabacionSection = `
5. ASISTENCIA DIGITAL CLÍNICA Y REGISTRO DE AUDIO DE SESIONES (LEY N° 19.628)
Con el objetivo de resguardar la rigurosidad del proceso terapéutico, optimizar la confección de notas clínicas y preparar adecuadamente cada intervención, el/la profesional tratante podrá apoyarse en la plataforma clínica digital Psiconex.
En estricto cumplimiento de la Ley N° 19.628 sobre Protección de la Vida Privada y Tratamiento de Datos Personales, se establece y garantiza:
a) Finalidad Exclusiva: El eventual registro de audio y/o transcripción digital se destina de manera única y exclusiva a fines de apoyo clínico, análisis terapéutico y resguardo de la ficha clínica del/de la profesional tratante.
b) Cifrado y Confidencialidad: Todos los registros son tratados bajo estrictos protocolos de ciberseguridad, incluyendo cifrado de datos en reposo (AES-256) y transmisión segura (TLS 1.3). La información permanece bajo control del profesional tratante y jamás será vendida, transferida ni compartida con terceros ajenos al proceso terapéutico.
c) Voluntariedad y Revocación: La autorización para la asistencia digital o registro de audio es enteramente voluntaria. El/la paciente podrá solicitar en cualquier momento la interrupción de la grabación durante una sesión o revocar este consentimiento cuando lo estime oportuno, sin que ello afecte la continuidad ni la calidad de la atención psicológica.`;
      }

      let acuerdosSection = "";
      if (acuerdosAdicionales.trim()) {
        acuerdosSection = `
${incluirGrabacion ? "6" : "5"}. ACUERDOS Y CONDICIONES ESPECÍFICAS DE ATENCIÓN
${acuerdosAdicionales.trim()}
`;
      }

      const numDerechos = incluirGrabacion ? (acuerdosAdicionales.trim() ? "7" : "6") : (acuerdosAdicionales.trim() ? "6" : "5");
      const numDeclaracion = incluirGrabacion ? (acuerdosAdicionales.trim() ? "8" : "7") : (acuerdosAdicionales.trim() ? "7" : "6");

      return `CONSENTIMIENTO INFORMADO PARA ATENCIÓN PSICOLÓGICA Y ASISTENCIA DIGITAL DE SESIONES
(Marco Legal: Ley N° 19.628 sobre Protección de la Vida Privada, Ley N° 20.584 de Derechos y Deberes en Salud, y Código de Ética del Colegio de Psicólogos de Chile)

LUGAR Y FECHA:
${ciudad}, ${fecha}

1. INDIVIDUALIZACIÓN DEL/DE LA PROFESIONAL TRATANTE
- Nombre del Profesional: ${pNombre}
- Cédula de Identidad (RUT): ${pRut}
- Registro Profesional / N° SIS: ${pReg}
- Especialidad / Formación: ${pEsp}
- Modalidad y Lugar de Atención: ${pLugar}

2. INDIVIDUALIZACIÓN DEL/DE LA PACIENTE
- Nombre Completo: ${pacNom}
- Cédula de Identidad (RUT): ${pacR}
- Edad: ${pacEd}
- Domicilio: ${pacDom}
- Teléfono / Correo de Contacto: ${pacCont}${tutorSection}

3. ENCUADRE Y NATURALEZA DEL PROCESO PSICOLÓGICO
El proceso de atención psicológica contempla instancias de evaluación, diagnóstico y/o intervención terapéutica dirigidas a promover el bienestar y salud mental del/de la paciente. La relación psicoterapéutica se funda en el respeto recíproco, la honestidad y el trabajo colaborativo. Los objetivos terapéuticos y la periodicidad de las sesiones serán informados y acordados entre ambas partes.

4. CONFIDENCIALIDAD Y SECRETO PROFESIONAL
Toda la información revelada en el contexto de las sesiones se encuentra amparada por el Secreto Profesional, conforme a las directrices éticas del Colegio de Psicólogos de Chile y a la Ley N° 20.584. 
Dicha confidencialidad solo podrá ser excepcionada en las situaciones legal y éticamente previstas:
a) Ante riesgo inminente, grave y manifiesto para la integridad física o vida del/de la paciente o de terceros.
b) Por requerimiento fundado y formal emanado de los Tribunales de Justicia competentes.
c) Al tomar conocimiento verídico de situaciones constitutivas de vulneración grave o abuso hacia niños, niñas, adolescentes o adultos en condición de dependencia o incapacidad, según lo mandata la ley penal chilena.${grabacionSection}

${numDerechos}. DERECHOS DEL/DE LA PACIENTE (LEY N° 20.584 Y LEY N° 19.628)
El/la paciente (o su tutor legal) tiene derecho a:
- Recibir información clara, suficiente y comprensible acerca de su estado de salud, evolución y propuestas de tratamiento.
- Realizar todas las preguntas que considere pertinentes antes, durante y después del proceso.
- Ejercer los derechos de información, actualización o rectificación sobre sus datos personales sensibles conforme a la Ley N° 19.628.
- Suspender o dar por finalizado voluntariamente el tratamiento en cualquier momento si así lo decide.

${numDeclaracion}. DECLARACIÓN Y CONSENTIMIENTO
"Declaro que he leído el presente documento (o que me ha sido explicado detalladamente por el/la profesional tratante). He contado con el tiempo y la instancia para plantear preguntas y aclarar todas mis inquietudes. Comprendo la naturaleza del tratamiento, los límites de la confidencialidad, las garantías de privacidad de mis datos personales y, de conformidad con lo expuesto, otorgo de manera libre e informada mi consentimiento para la atención psicológica y el registro asistido seguro de las sesiones clínicas."


_________________________________________             _________________________________________
Firma del/de la Paciente o Tutor/a Legal             Firma del/de la Profesional Psicólogo/a
Nombre: ${esMenor && tutorNombre ? tutorNombre : pacNom}
RUT: ${esMenor && tutorNombre ? "[RUT Tutor]" : pacR}                                   Nombre: ${pNombre}
Fecha: ${fecha}                                       RUT: ${pRut}
                                                      Registro Profesional: ${pReg}`;
    };
  }, [
    ciudad,
    fecha,
    psicologoNombre,
    psicologoRut,
    psicologoRegistro,
    psicologoEspecialidad,
    psicologoLugar,
    pacienteNombre,
    pacienteRut,
    pacienteEdad,
    pacienteDomicilio,
    pacienteContacto,
    esMenor,
    tutorNombre,
    tutorTelefono,
    incluirGrabacion,
    acuerdosAdicionales,
    paciente,
  ]);

  // Initialize or update document content if not manually edited
  useEffect(() => {
    if (!hasManuallyEdited) {
      setDocumentContent(buildTemplate());
    }
  }, [buildTemplate, hasManuallyEdited]);

  function handleResetTemplate() {
    setHasManuallyEdited(false);
    setDocumentContent(buildTemplate());
    setSaveSuccess(false);
    setErrorMessage("");
  }

  function handleCopyText() {
    navigator.clipboard.writeText(documentContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  }

  function handlePrintDocument() {
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (popups) para imprimir el documento.");
      return;
    }

    // Convert newlines to formatted paragraphs / lines
    const paragraphs = documentContent
      .split("\n\n")
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("CONSENTIMIENTO INFORMADO")) {
          return `<h1 style="font-size:13pt;text-align:center;font-weight:bold;margin-bottom:4px;letter-spacing:0.5px;color:#0f172a;">${trimmed}</h1>`;
        }
        if (trimmed.startsWith("(Marco Legal:")) {
          return `<h2 style="font-size:9.5pt;text-align:center;color:#475569;margin-bottom:20px;font-style:italic;">${trimmed}</h2>`;
        }
        if (/^\d+\.\s+[A-ZÁÉÍÓÚÑ\s]+/.test(trimmed)) {
          const lines = trimmed.split("\n");
          const title = lines[0];
          const rest = lines.slice(1).join("<br>");
          return `<div style="margin-top:14px;margin-bottom:8px;">
            <div style="font-size:10pt;font-weight:bold;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-bottom:4px;text-transform:uppercase;">${title}</div>
            <div style="font-size:9.5pt;color:#1e293b;line-height:1.5;">${rest}</div>
          </div>`;
        }
        if (trimmed.startsWith("_________________________________________")) {
          return `<pre style="font-family:inherit;white-space:pre-wrap;font-size:9pt;margin-top:35px;line-height:1.4;color:#0f172a;">${trimmed}</pre>`;
        }
        return `<p style="font-size:9.5pt;line-height:1.5;margin-bottom:8px;text-align:justify;color:#1e293b;">${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Consentimiento Informado - ${paciente.nombre_completo}</title>
        <style>
          @page { size: letter; margin: 18mm 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 10px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div style="max-width:760px;margin:0 auto;">
          ${paragraphs}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  function handleDownloadWord() {
    const formattedHtml = documentContent
      .split("\n\n")
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("CONSENTIMIENTO INFORMADO")) {
          return `<h1>${trimmed}</h1>`;
        }
        if (trimmed.startsWith("(Marco Legal:")) {
          return `<h2>${trimmed}</h2>`;
        }
        if (/^\d+\.\s+[A-ZÁÉÍÓÚÑ\s]+/.test(trimmed)) {
          const lines = trimmed.split("\n");
          return `<h3>${lines[0]}</h3><p>${lines.slice(1).join("<br>")}</p>`;
        }
        if (trimmed.startsWith("_________________________________________")) {
          return `<pre style="margin-top:40px;font-family:Arial,sans-serif;">${trimmed}</pre>`;
        }
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

    const wordDocument = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Consentimiento Informado</title>
    <style>
      body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 2.5cm; }
      h1 { font-size: 13pt; text-align: center; font-weight: bold; margin-bottom: 4px; }
      h2 { font-size: 9.5pt; text-align: center; color: #555; margin-bottom: 18px; font-style: italic; }
      h3 { font-size: 11pt; font-weight: bold; margin-top: 14px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
      p { margin-bottom: 8px; text-align: justify; }
    </style></head><body>${formattedHtml}</body></html>`;

    const blob = new Blob(["\ufeff" + wordDocument], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (paciente.nombre_completo || "paciente")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    link.href = url;
    link.download = `consentimiento-informado-${safeName}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadTxt() {
    const blob = new Blob([documentContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (paciente.nombre_completo || "paciente")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    link.href = url;
    link.download = `consentimiento-informado-${safeName}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveToFicha() {
    setSavingInforme(true);
    setSaveSuccess(false);
    setErrorMessage("");
    try {
      const res = await apiFetch("/chat/informes/", {
        method: "POST",
        body: JSON.stringify({
          paciente: paciente.id,
          tipo: "OTRO",
          titulo: `Consentimiento Informado Ley 19.628 - ${paciente.nombre_completo}`,
          contenido: documentContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail || errorData.non_field_errors?.[0] || "No se pudo guardar en la ficha."
        );
      }

      setSaveSuccess(true);
      if (onSavedToFicha) {
        onSavedToFicha();
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(errObj?.message || "Ocurrió un error al guardar el consentimiento.");
    } finally {
      setSavingInforme(false);
    }
  }

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-border/70 bg-card shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 border border-violet-500/20">
              <FileSignature className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  Plantilla de Consentimiento Informado
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" />
                  Ley 19.628 Chile
                </span>
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                  Colegio de Psicólogos
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Documento legal editable estructurado con los datos de{" "}
                <span className="font-semibold text-foreground">{paciente.nombre_completo}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-6 py-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-muted/80 p-1 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "preview"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Vista previa formal</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "edit"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileSignature className="h-3.5 w-3.5" />
              <span>Editor de texto libre</span>
              {hasManuallyEdited && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Editado a mano" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("params")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "params"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Datos y Parámetros</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Restablecer documento a los datos originales de la ficha"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restablecer plantilla</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-muted/10">
          {activeTab === "preview" && (
            <div className="mx-auto max-w-2xl rounded-xl border border-border/80 bg-card p-7 sm:p-9 shadow-subtle text-foreground text-xs leading-relaxed">
              <div className="border-b border-border/60 pb-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  República de Chile · Marco Clínico y Legal
                </p>
                <h4 className="mt-1 text-sm sm:text-base font-extrabold uppercase tracking-tight text-foreground">
                  Consentimiento Informado para Atención Psicológica y Asistencia Digital de Sesiones
                </h4>
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  En cumplimiento de la Ley N° 19.628 (Protección de la Vida Privada), Ley N° 20.584 (Derechos y Deberes en Salud) y el Código de Ética del Colegio de Psicólogos de Chile
                </p>
              </div>

              <div className="mt-5 space-y-4 whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed text-foreground/90">
                {documentContent}
              </div>
            </div>
          )}

          {activeTab === "edit" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Modifica cualquier palabra o cláusula libremente. El texto actualizado se mantendrá para imprimir, descargar y guardar.
                </p>
                {hasManuallyEdited && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    (Cambios manuales aplicados)
                  </span>
                )}
              </div>
              <textarea
                value={documentContent}
                onChange={(e) => {
                  setDocumentContent(e.target.value);
                  setHasManuallyEdited(true);
                }}
                rows={20}
                className="w-full rounded-xl border border-input bg-card p-4 font-mono text-xs sm:text-sm leading-relaxed text-foreground shadow-inner focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-y"
                placeholder="Escribe o ajusta el consentimiento aquí..."
              />
            </div>
          )}

          {activeTab === "params" && (
            <div className="space-y-6">
              {loadingUser && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando datos profesionales del psicólogo desde tu perfil...</span>
                </div>
              )}

              {/* Psicologo params */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <span>1. Datos del Profesional Psicólogo/a</span>
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Nombre y Apellido</span>
                    <input
                      type="text"
                      value={psicologoNombre}
                      onChange={(e) => {
                        setPsicologoNombre(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      placeholder="Ej: Lic. Valentina Pérez"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">RUT Profesional</span>
                    <input
                      type="text"
                      value={psicologoRut}
                      onChange={(e) => {
                        setPsicologoRut(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      placeholder="Ej: 15.432.890-K"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Registro SIS / Colegio de Psicólogos</span>
                    <input
                      type="text"
                      value={psicologoRegistro}
                      onChange={(e) => {
                        setPsicologoRegistro(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      placeholder="Ej: Registro SIS N° 458921"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Especialidad / Enfoque</span>
                    <input
                      type="text"
                      value={psicologoEspecialidad}
                      onChange={(e) => {
                        setPsicologoEspecialidad(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      placeholder="Ej: Psicología Clínica Cognitivo-Conductual"
                    />
                  </label>
                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="font-semibold text-muted-foreground">Lugar de Consulta o Modalidad</span>
                    <input
                      type="text"
                      value={psicologoLugar}
                      onChange={(e) => {
                        setPsicologoLugar(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      placeholder="Ej: Av. Providencia 1234 Of. 502 / Modalidad Online"
                    />
                  </label>
                </div>
              </div>

              {/* Paciente params */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span>2. Datos del/de la Paciente (Pre-cargados)</span>
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Nombre Completo</span>
                    <input
                      type="text"
                      value={pacienteNombre}
                      onChange={(e) => {
                        setPacienteNombre(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">RUT</span>
                    <input
                      type="text"
                      value={pacienteRut}
                      onChange={(e) => {
                        setPacienteRut(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Edad</span>
                    <input
                      type="text"
                      value={pacienteEdad}
                      onChange={(e) => {
                        setPacienteEdad(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="font-semibold text-muted-foreground">Domicilio / Comuna</span>
                    <input
                      type="text"
                      value={pacienteDomicilio}
                      onChange={(e) => {
                        setPacienteDomicilio(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Teléfono / Email</span>
                    <input
                      type="text"
                      value={pacienteContacto}
                      onChange={(e) => {
                        setPacienteContacto(e.target.value);
                        setHasManuallyEdited(false);
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                  </label>
                </div>

                {/* Tutor checkbox */}
                <div className="pt-2 border-t border-border/50">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={esMenor}
                      onChange={(e) => {
                        setEsMenor(e.target.checked);
                        setHasManuallyEdited(false);
                      }}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="font-semibold text-foreground">
                      Paciente menor de edad o con tutor legal requerido
                    </span>
                  </label>
                  {esMenor && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 rounded-lg bg-muted/40 p-3 border border-border/60">
                      <label className="space-y-1 text-xs">
                        <span className="font-semibold text-muted-foreground">Nombre Tutor/a</span>
                        <input
                          type="text"
                          value={tutorNombre}
                          onChange={(e) => {
                            setTutorNombre(e.target.value);
                            setHasManuallyEdited(false);
                          }}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                          placeholder="Nombre del padre, madre o apoderado"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="font-semibold text-muted-foreground">Teléfono Tutor/a</span>
                        <input
                          type="text"
                          value={tutorTelefono}
                          onChange={(e) => {
                            setTutorTelefono(e.target.value);
                            setHasManuallyEdited(false);
                          }}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                          placeholder="+56 9 ..."
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Cláusula Ley 19.628 y adicionales */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  3. Cláusulas y Condiciones del Documento
                </h4>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 text-xs cursor-pointer p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={incluirGrabacion}
                      onChange={(e) => {
                        setIncluirGrabacion(e.target.checked);
                        setHasManuallyEdited(false);
                      }}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">
                        Incluir cláusula explícita de Registro Digital y Asistencia IA en Psiconex (Ley 19.628)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Estipula el consentimiento del paciente para la toma de notas asistida por audio, cifrado de extremo a extremo, no cesión de datos y el derecho a revocar la grabación en cualquier momento.
                      </span>
                    </div>
                  </label>

                  <div className="pt-2">
                    <label className="space-y-1 text-xs">
                      <span className="font-semibold text-muted-foreground">
                        Acuerdos adicionales o notas particulares (opcional)
                      </span>
                      <textarea
                        value={acuerdosAdicionales}
                        onChange={(e) => {
                          setAcuerdosAdicionales(e.target.value);
                          setHasManuallyEdited(false);
                        }}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background p-2.5 text-xs"
                        placeholder="Ej: Políticas de cancelación de sesión con 24 hrs de anticipación, arancel acordado por sesión, etc."
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Messages */}
        {saveSuccess && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Consentimiento informado guardado exitosamente en la ficha del paciente (disponible en la sección de Informes).
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintDocument}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadWord}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent cursor-pointer"
              title="Descargar archivo .doc editable para Microsoft Word"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Word (.doc)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-2.5 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent cursor-pointer"
              title="Descargar archivo en texto plano"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Texto (.txt)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent cursor-pointer"
            >
              {copySuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copiar texto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveToFicha}
              disabled={savingInforme}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 shadow-xs transition-all hover:bg-violet-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Guarda una copia de este consentimiento en la ficha clínica del paciente"
            >
              {savingInforme ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{savingInforme ? "Guardando..." : "Guardar en Ficha"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
