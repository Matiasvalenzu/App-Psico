"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Send,
  ExternalLink,
  Mail,
  Clock,
  UserCheck,
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

interface ConsentRecord {
  id: number;
  estado: "BORRADOR" | "ENVIADO" | "FIRMADO" | "RECHAZADO";
  enlace_firma: string;
  email_destino: string;
  email_enviado: boolean;
  email_error: string;
  fecha_envio: string | null;
  fecha_firma: string | null;
  firma_nombre: string;
  firma_rut: string;
  firma_imagen: string;
  firma_ip: string;
  contenido: string;
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
  const [activeTab, setActiveTab] = useState<"digital_sign" | "preview" | "params" | "edit">("digital_sign");
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingConsent, setLoadingConsent] = useState(false);
  const [savingInforme, setSavingInforme] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const [copySuccess, setCopySuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Backend persisted consent record
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [emailDestino, setEmailDestino] = useState(paciente.email_contacto || "");

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

  // Fetch backend consent record & psychologist profile
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    async function loadData() {
      setLoadingUser(true);
      setLoadingConsent(true);
      try {
        const [profile, consentRes] = await Promise.all([
          getCurrentUser().catch(() => ({} as PsychologistProfile)),
          apiFetch(`/pacientes/${paciente.id}/consentimiento/`).catch(() => null),
        ]);

        if (isCancelled) return;

        // Populate psychologist
        if (profile) {
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
        }

        // Populate consent if exists
        if (consentRes && consentRes.ok) {
          const data = await consentRes.json();
          if (data.consentimiento) {
            setConsentRecord(data.consentimiento);
            if (data.consentimiento.email_destino) {
              setEmailDestino(data.consentimiento.email_destino);
            }
            if (data.consentimiento.contenido) {
              setDocumentContent(data.consentimiento.contenido);
              setHasManuallyEdited(true);
            }
          }
        }
      } catch (err) {
        console.warn("Error al cargar datos del consentimiento:", err);
      } finally {
        if (!isCancelled) {
          setLoadingUser(false);
          setLoadingConsent(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, paciente.id]);

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
c) Al tomar conocimiento verídico de situaciones constitutivas de vulneración grave o abuso hacia niños, niñas, adolescentes o adultos en condición de dependencia o incapacidad, según lo mandata la ley penal chilena.${grabacionSection}${acuerdosSection}

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
    setEmailSuccessMsg("");
    setErrorMessage("");
  }

  // SEND BY EMAIL
  async function handleSendEmail() {
    if (!emailDestino.trim()) {
      setErrorMessage("Por favor ingresa o verifica el correo electrónico del paciente.");
      return;
    }
    setSendingEmail(true);
    setErrorMessage("");
    setEmailSuccessMsg("");
    try {
      const res = await apiFetch(`/pacientes/${paciente.id}/consentimiento/`, {
        method: "POST",
        body: JSON.stringify({
          contenido: documentContent,
          email_destino: emailDestino.trim(),
          enviar_email: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "No se pudo enviar el correo de consentimiento.");
      }
      setConsentRecord(data);
      setEmailSuccessMsg(`¡Consentimiento enviado con éxito a ${emailDestino}! El paciente podrá firmarlo desde su correo.`);
      if (onSavedToFicha) onSavedToFicha();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(errObj?.message || "Error al enviar el correo.");
    } finally {
      setSendingEmail(false);
    }
  }

  // RESEND EMAIL
  async function handleResendEmail() {
    if (!consentRecord?.id) return;
    setSendingEmail(true);
    setErrorMessage("");
    setEmailSuccessMsg("");
    try {
      const res = await apiFetch(`/pacientes/consentimiento/${consentRecord.id}/enviar/`, {
        method: "POST",
        body: JSON.stringify({
          email_destino: emailDestino.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo reenviar el correo.");
      }
      setConsentRecord(data.consentimiento);
      setEmailSuccessMsg(`Correo reenviado exitosamente a ${emailDestino}.`);
      if (onSavedToFicha) onSavedToFicha();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(errObj?.message || "Error al reenviar el correo.");
    } finally {
      setSendingEmail(false);
    }
  }

  // GENERATE PUBLIC LINK
  async function handleGenerateLink() {
    setGeneratingLink(true);
    setErrorMessage("");
    setEmailSuccessMsg("");
    try {
      const res = await apiFetch(`/pacientes/${paciente.id}/consentimiento/`, {
        method: "POST",
        body: JSON.stringify({
          contenido: documentContent,
          email_destino: emailDestino.trim(),
          enviar_email: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "No se pudo generar el enlace de firma.");
      }
      setConsentRecord(data);
      if (data.enlace_firma || data.public_url) {
        navigator.clipboard.writeText(data.enlace_firma || data.public_url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      }
      if (onSavedToFicha) onSavedToFicha();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(errObj?.message || "Error al generar el enlace.");
    } finally {
      setGeneratingLink(false);
    }
  }

  function handleCopyExistingLink() {
    if (!consentRecord?.enlace_firma) return;
    navigator.clipboard.writeText(consentRecord.enlace_firma);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
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

    let firmaDigitalBox = "";
    if (consentRecord?.estado === "FIRMADO") {
      firmaDigitalBox = `
        <div style="margin-top:25px;padding:12px;border:1px solid #10b981;border-radius:8px;background:#ecfdf5;font-size:9pt;">
          <strong>✓ CERTIFICADO DE FIRMA DIGITAL ELECTRÓNICA (LEY 19.628)</strong><br>
          Firmante: ${consentRecord.firma_nombre || paciente.nombre_completo}<br>
          RUT: ${consentRecord.firma_rut || paciente.rut || "No especificado"}<br>
          Fecha: ${consentRecord.fecha_firma ? new Date(consentRecord.fecha_firma).toLocaleString("es-CL") : "Registrada"}<br>
          ${consentRecord.firma_imagen ? `<img src="${consentRecord.firma_imagen}" style="max-height:60px;margin-top:5px;display:block;">` : ""}
        </div>
      `;
    }

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
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div style="max-width:760px;margin:0 auto;">
          ${paragraphs}
          ${firmaDigitalBox}
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

  const isSigned = consentRecord?.estado === "FIRMADO";
  const isSent = consentRecord?.estado === "ENVIADO";

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
                  Consentimiento Informado del Paciente
                </h3>
                {isSigned ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Firmado Digitalmente
                  </span>
                ) : isSent ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    <Clock className="h-3 w-3" />
                    Pendiente de Firma
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 border border-violet-500/20">
                    <ShieldCheck className="h-3 w-3" />
                    Ley 19.628 Chile
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Documento legal generado automáticamente para{" "}
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
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-6 py-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 rounded-xl bg-muted/80 p-1 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("digital_sign")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "digital_sign"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Send className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span>Enviar y Firma Digital</span>
              {isSigned && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
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
              onClick={() => setActiveTab("params")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "params"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Datos del documento</span>
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
              <span>Editar redacción completa</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {hasManuallyEdited && (
              <button
                type="button"
                onClick={handleResetTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Restablecer texto desde los parámetros actuales"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB: DIGITAL SIGN & EMAIL */}
          {activeTab === "digital_sign" && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Signed Status Banner */}
              {isSigned ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-6 dark:bg-emerald-950/20">
                  <div className="flex items-start gap-3.5">
                    <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                          Consentimiento Informado Firmado Digitalmente
                        </h4>
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Válido y Custodiado
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                        El paciente ha otorgado voluntariamente su consentimiento informado electrónico de acuerdo
                        con la Ley N° 19.628 y la Ley N° 20.584.
                      </p>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card/80 p-3.5 rounded-xl border border-emerald-500/20">
                        <div>
                          <span className="text-muted-foreground font-medium">Firmante:</span>{" "}
                          <strong className="text-foreground">{consentRecord.firma_nombre || paciente.nombre_completo}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">RUT:</span>{" "}
                          <strong className="font-mono text-foreground">{consentRecord.firma_rut || paciente.rut || "No registrado"}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Fecha y Hora:</span>{" "}
                          <strong className="text-foreground">
                            {consentRecord.fecha_firma ? new Date(consentRecord.fecha_firma).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : "N/A"}
                          </strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Dirección IP:</span>{" "}
                          <span className="font-mono text-muted-foreground">{consentRecord.firma_ip || "Auditada"}</span>
                        </div>
                      </div>

                      {consentRecord.firma_imagen && (
                        <div className="mt-3.5 bg-card p-3 rounded-xl border border-border/80 inline-block">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                            Firma digital registrada:
                          </span>
                          <img
                            src={consentRecord.firma_imagen}
                            alt="Trazo de firma digital"
                            className="h-16 max-w-full object-contain bg-white rounded p-1 border border-border/40"
                          />
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {consentRecord.enlace_firma && (
                          <a
                            href={consentRecord.enlace_firma}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-primary" />
                            <span>Ver documento firmado</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={handlePrintDocument}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Imprimir / Descargar PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Action 1: Enviar por Correo */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Enviar por Correo Electrónico al Paciente
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      El paciente recibirá un correo con formato institucional y un botón directo para firmar desde su móvil o computador.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Correo Electrónico de Destino
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="email"
                        value={emailDestino}
                        onChange={(e) => setEmailDestino(e.target.value)}
                        placeholder="correo@ejemplo.cl"
                        className="flex-1 rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      {consentRecord?.id ? (
                        <button
                          type="button"
                          onClick={handleResendEmail}
                          disabled={sendingEmail || !emailDestino.trim()}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                        >
                          {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          <span>Reenviar correo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendEmail}
                          disabled={sendingEmail || !emailDestino.trim()}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                        >
                          {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          <span>Enviar por correo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isSent && !isSigned && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20">
                      <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Enviado el{" "}
                        <strong>
                          {consentRecord.fecha_envio ? new Date(consentRecord.fecha_envio).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : "recientemente"}
                        </strong>
                        . Esperando que el paciente abra el enlace y complete su firma.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action 2: Enlace de Firma Digital */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Enlace Directo para Firma Digital
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Puedes copiar el enlace para enviarlo por WhatsApp, Telegram o abrirlo tú mismo si el paciente está presente.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  {consentRecord?.enlace_firma ? (
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={consentRecord.enlace_firma}
                          className="w-full rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2 text-xs text-foreground font-mono select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleCopyExistingLink}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent cursor-pointer shrink-0"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-600">¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copiar enlace</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <a
                          href={consentRecord.enlace_firma}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <span>Abrir página de firma en nueva pestaña</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={handleGenerateLink}
                        disabled={generatingLink}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-50/60 px-4 py-2 text-xs font-semibold text-violet-700 shadow-xs transition-all hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300 cursor-pointer"
                      >
                        {generatingLink ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileSignature className="h-3.5 w-3.5" />
                        )}
                        <span>Generar enlace de firma digital</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PREVIEW */}
          {activeTab === "preview" && (
            <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs font-serif text-foreground/90 text-sm leading-relaxed max-w-3xl mx-auto space-y-4 whitespace-pre-wrap select-text">
              {documentContent}
            </div>
          )}

          {/* TAB: EDIT FULL TEXT */}
          {activeTab === "edit" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Redacción Completa del Documento (Editable)
                </label>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restablecer a plantilla estándar
                </button>
              </div>
              <textarea
                rows={22}
                value={documentContent}
                onChange={(e) => {
                  setDocumentContent(e.target.value);
                  setHasManuallyEdited(true);
                }}
                className="w-full rounded-xl border border-border/80 bg-background p-4 text-xs sm:text-sm font-mono leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* TAB: PARAMS */}
          {activeTab === "params" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Psychologist info */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-2">
                  Datos del / de la Profesional
                </h4>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={psicologoNombre}
                    onChange={(e) => setPsicologoNombre(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Cédula de Identidad (RUT)
                  </label>
                  <input
                    type="text"
                    value={psicologoRut}
                    onChange={(e) => setPsicologoRut(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    N° Registro SIS / Profesional
                  </label>
                  <input
                    type="text"
                    value={psicologoRegistro}
                    onChange={(e) => setPsicologoRegistro(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Especialidad o Enfoque
                  </label>
                  <input
                    type="text"
                    value={psicologoEspecialidad}
                    onChange={(e) => setPsicologoEspecialidad(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Lugar de atención / Consulta
                  </label>
                  <input
                    type="text"
                    value={psicologoLugar}
                    onChange={(e) => setPsicologoLugar(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Patient info */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-2">
                  Datos del Paciente
                </h4>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={pacienteNombre}
                    onChange={(e) => setPacienteNombre(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    RUT del Paciente
                  </label>
                  <input
                    type="text"
                    value={pacienteRut}
                    onChange={(e) => setPacienteRut(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Edad
                  </label>
                  <input
                    type="text"
                    value={pacienteEdad}
                    onChange={(e) => setPacienteEdad(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Domicilio y Comuna
                  </label>
                  <input
                    type="text"
                    value={pacienteDomicilio}
                    onChange={(e) => setPacienteDomicilio(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Contacto (WhatsApp / Correo)
                  </label>
                  <input
                    type="text"
                    value={pacienteContacto}
                    onChange={(e) => setPacienteContacto(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="md:col-span-2 rounded-2xl border border-border/80 bg-card p-5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-2">
                  Cláusulas y Condiciones Específicas
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="grabacion"
                    checked={incluirGrabacion}
                    onChange={(e) => setIncluirGrabacion(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="grabacion" className="text-xs font-medium text-foreground cursor-pointer">
                    Incluir cláusula de Asistencia Digital Clínica y Registro de Audio de Sesiones (Ley 19.628)
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Acuerdos y condiciones adicionales (opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={acuerdosAdicionales}
                    onChange={(e) => setAcuerdosAdicionales(e.target.value)}
                    placeholder="Ej: Las cancelaciones deben realizarse con al menos 24 horas de anticipación..."
                    className="w-full rounded-xl border border-border/80 bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Messages */}
        {emailSuccessMsg && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{emailSuccessMsg}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Consentimiento informado guardado exitosamente en la ficha del paciente (sección Informes).</span>
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
              title="Guarda una copia de este consentimiento en la sección de Informes de la ficha"
            >
              {savingInforme ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{savingInforme ? "Guardando..." : "Guardar en Informes"}</span>
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
