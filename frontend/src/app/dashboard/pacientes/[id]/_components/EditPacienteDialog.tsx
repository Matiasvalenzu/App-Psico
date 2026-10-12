"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatRut } from "@/lib/rut";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calcularEdad, formatDateInputValue, type Paciente } from "./utils";

type TextFields = {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  rut: string;
  sexo: string;
  ocupacion_laboral: string;
  motivo_consulta: string;
  telefono_whatsapp: string;
  email_contacto: string;
  nacionalidad: string;
  religion: string;
  direccion: string;
  comuna: string;
  prevision: string;
  nombre_tutor: string;
  telefono_tutor: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  origen_consulta: string;
  derivacion_interconsulta: string;
  diagnostico_sospechado: string;
  medicacion_actual: string;
  ideacion_suicida_nivel: string;
  frecuencia_atencion: string;
  objetivos_intervencion: string;
  notas_privadas: string;
};

type FormState = TextFields & { es_menor_edad: boolean; riesgo_suicida: boolean };

function toForm(p: Paciente): FormState {
  return {
    nombre: p.nombre,
    apellido: p.apellido,
    fecha_nacimiento: formatDateInputValue(p.fecha_nacimiento),
    rut: p.rut || "",
    sexo: p.sexo || "N",
    ocupacion_laboral: p.ocupacion_laboral || "",
    motivo_consulta: p.motivo_consulta || "",
    telefono_whatsapp: p.telefono_whatsapp || "",
    email_contacto: p.email_contacto || "",
    nacionalidad: p.nacionalidad || "",
    religion: p.religion || "",
    direccion: p.direccion || "",
    comuna: p.comuna || "",
    prevision: p.prevision || "",
    es_menor_edad: Boolean(p.es_menor_edad),
    nombre_tutor: p.nombre_tutor || "",
    telefono_tutor: p.telefono_tutor || "",
    contacto_emergencia_nombre: p.contacto_emergencia_nombre || "",
    contacto_emergencia_telefono: p.contacto_emergencia_telefono || "",
    origen_consulta: p.origen_consulta || "",
    derivacion_interconsulta: p.derivacion_interconsulta || "",
    diagnostico_sospechado: p.diagnostico_sospechado || "",
    medicacion_actual: p.medicacion_actual || "",
    riesgo_suicida: Boolean(p.riesgo_suicida),
    ideacion_suicida_nivel: p.ideacion_suicida_nivel?.toString() || "",
    frecuencia_atencion: p.frecuencia_atencion || "",
    objetivos_intervencion: p.objetivos_intervencion || "",
    notas_privadas: p.notas_privadas || "",
  };
}

const sectionClass = "rounded-xl border border-border/70";
const triggerClass = "px-4 py-3 text-sm font-semibold";
const contentClass = "grid gap-4 border-t border-border/60 p-4 sm:grid-cols-2";

// Edición de la ficha agrupada por secciones; muestra los errores del backend por campo.
export default function EditPacienteDialog({
  open,
  paciente,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  paciente: Paciente;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Paciente) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(paciente));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Se fija al abrir para que desmarcar un checkbox no cierre la sección.
  const [riesgoAbierto, setRiesgoAbierto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(paciente));
    setRiesgoAbierto(Boolean(paciente.riesgo_suicida || paciente.es_menor_edad));
    setError("");
    setFieldErrors({});
  }, [open, paciente]);

  const edad = calcularEdad(form.fecha_nacimiento) ?? paciente.edad;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function field(key: keyof TextFields, label: string, props: React.ComponentProps<typeof Input> = {}) {
    const inputId = `edit-${key}`;
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <Input
          id={inputId}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={Boolean(fieldErrors[key]) || undefined}
          {...props}
        />
        {fieldErrors[key] && <p className="text-xs text-destructive">{fieldErrors[key]}</p>}
      </div>
    );
  }

  function textarea(key: keyof TextFields, label: string, props: React.ComponentProps<typeof Textarea> = {}) {
    const inputId = `edit-${key}`;
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <Textarea id={inputId} value={form[key]} onChange={(e) => set(key, e.target.value)} rows={3} {...props} />
        {fieldErrors[key] && <p className="text-xs text-destructive">{fieldErrors[key]}</p>}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await apiFetch(`/pacientes/${paciente.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          fecha_nacimiento: form.fecha_nacimiento || null,
          edad: edad ?? null,
          ideacion_suicida_nivel: form.ideacion_suicida_nivel ? parseInt(form.ideacion_suicida_nivel) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errors: Record<string, string> = {};
        let singleMessage = "";
        if (data && typeof data === "object") {
          for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            const message = Array.isArray(value) ? String(value[0]) : String(value);
            if (key in form) {
              errors[key] = message;
            } else if (key === "detail" || key === "non_field_errors") {
              singleMessage = message;
            } else {
              singleMessage = `${key}: ${message}`;
            }
          }
        }
        setFieldErrors(errors);
        const errorKeys = Object.keys(errors);
        if (errorKeys.length === 1) {
          setError(errors[errorKeys[0]]);
        } else if (errorKeys.length > 1) {
          setError("Revisa los campos marcados.");
        } else if (singleMessage) {
          setError(singleMessage);
        } else {
          setError("No se pudieron guardar los cambios.");
        }
        return;
      }
      onSaved(data);
      onOpenChange(false);
    } catch {
      setError("No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar paciente</DialogTitle>
          <DialogDescription>Solo nombre y apellido son obligatorios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Accordion className="space-y-3">
            <AccordionItem className={sectionClass} open>
              <AccordionTrigger className={triggerClass}>Datos personales</AccordionTrigger>
              <AccordionContent className={contentClass}>
                {field("nombre", "Nombre", { required: true })}
                {field("apellido", "Apellido", { required: true })}
                {field("rut", "RUT", {
                  placeholder: "Ej: 12.345.678-9",
                  onBlur: () => form.rut && set("rut", formatRut(form.rut)),
                })}
                {field("fecha_nacimiento", "Fecha de nacimiento", { type: "date" })}
                <div className="space-y-1.5">
                  <label htmlFor="edit-sexo" className="text-sm font-medium">
                    Sexo
                  </label>
                  <NativeSelect id="edit-sexo" value={form.sexo} onChange={(e) => set("sexo", e.target.value)}>
                    <option value="N">Prefiero no decir</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Edad</span>
                  <p className="flex h-9 items-center rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {edad ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Se calcula desde la fecha de nacimiento.</p>
                </div>
                {field("ocupacion_laboral", "Ocupación", { placeholder: "Ej: Ingeniero, Docente, Estudiante..." })}
                {field("nacionalidad", "Nacionalidad")}
                {field("religion", "Religión")}
                {field("prevision", "Previsión")}
                {textarea("motivo_consulta", "Motivo de consulta")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className={sectionClass}>
              <AccordionTrigger className={triggerClass}>Contacto</AccordionTrigger>
              <AccordionContent className={contentClass}>
                {field("telefono_whatsapp", "Teléfono WhatsApp", { type: "tel" })}
                {field("email_contacto", "Correo de contacto", { type: "email" })}
                {field("direccion", "Dirección")}
                {field("comuna", "Comuna")}
                {field("origen_consulta", "Origen de la consulta", {
                  placeholder: "Instagram, referido, CAF, boca a boca...",
                })}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className={sectionClass}>
              <AccordionTrigger className={triggerClass}>Información clínica</AccordionTrigger>
              <AccordionContent className={contentClass}>
                {field("frecuencia_atencion", "Frecuencia de atención", {
                  placeholder: "Semanal, quincenal, mensual, seguimiento...",
                })}
                {field("diagnostico_sospechado", "Diagnóstico sospechado")}
                {textarea("medicacion_actual", "Medicación actual", { rows: 2 })}
                {textarea("derivacion_interconsulta", "Derivación / interconsulta", { rows: 2 })}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className={sectionClass} open={riesgoAbierto || undefined}>
              <AccordionTrigger className={triggerClass}>Riesgo y tutor</AccordionTrigger>
              <AccordionContent className={contentClass}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.riesgo_suicida}
                    onChange={(e) => set("riesgo_suicida", e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-[hsl(var(--destructive))]"
                  />
                  Riesgo suicida activo o relevante
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.es_menor_edad}
                    onChange={(e) => set("es_menor_edad", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Menor de edad
                </label>
                <div className="space-y-1.5">
                  <label htmlFor="edit-ideacion" className="text-sm font-medium">
                    Nivel de ideación suicida
                  </label>
                  <NativeSelect
                    id="edit-ideacion"
                    value={form.ideacion_suicida_nivel}
                    onChange={(e) => set("ideacion_suicida_nivel", e.target.value)}
                  >
                    <option value="">Sin evaluar</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                  {fieldErrors.ideacion_suicida_nivel && (
                    <p className="text-xs text-destructive">{fieldErrors.ideacion_suicida_nivel}</p>
                  )}
                </div>
                <div className="hidden sm:block" />
                {field("contacto_emergencia_nombre", "Contacto de emergencia")}
                {field("contacto_emergencia_telefono", "Teléfono de emergencia", { type: "tel" })}
                {field("nombre_tutor", "Tutor o responsable")}
                {field("telefono_tutor", "Teléfono del tutor", { type: "tel" })}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className={sectionClass}>
              <AccordionTrigger className={triggerClass}>Objetivos</AccordionTrigger>
              <AccordionContent className={contentClass}>
                {textarea("objetivos_intervencion", "Objetivos de intervención", {
                  rows: 4,
                  placeholder: "Objetivos iniciales, focos de trabajo y metas del proceso...",
                })}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className={sectionClass}>
              <AccordionTrigger className={triggerClass}>Notas privadas</AccordionTrigger>
              <AccordionContent className={contentClass}>
                {textarea("notas_privadas", "Notas privadas (solo visibles para ti)")}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
