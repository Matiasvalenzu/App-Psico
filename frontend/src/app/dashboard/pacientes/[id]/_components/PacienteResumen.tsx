"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSexoLabel, type Paciente } from "./utils";

type Campo = { label: string; value: React.ReactNode; wide?: boolean };

function Seccion({ title, campos, onEdit }: { title: string; campos: Campo[]; onEdit: () => void }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {campos.map((campo) => (
          <div key={campo.label} className={campo.wide ? "sm:col-span-2" : undefined}>
            <dt className="text-xs font-medium text-muted-foreground">{campo.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">
              {campo.value || campo.value === 0 ? (
                campo.value
              ) : (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-muted-foreground/80 underline-offset-2 hover:text-primary hover:underline"
                >
                  Sin completar
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Pestaña "Resumen": datos del expediente como listas de definición y notas privadas.
export default function PacienteResumen({ paciente, onEdit }: { paciente: Paciente; onEdit: () => void }) {
  const [mostrarNotas, setMostrarNotas] = useState(false);

  return (
    <div className="space-y-4">
      <Seccion
        title="Motivo y objetivos"
        onEdit={onEdit}
        campos={[
          { label: "Motivo de consulta", value: paciente.motivo_consulta, wide: true },
          { label: "Objetivos de intervención", value: paciente.objetivos_intervencion, wide: true },
        ]}
      />
      <Seccion
        title="Datos personales"
        onEdit={onEdit}
        campos={[
          { label: "RUT", value: paciente.rut },
          { label: "Fecha de nacimiento", value: paciente.fecha_nacimiento ? formatDate(paciente.fecha_nacimiento) : null },
          { label: "Edad", value: paciente.edad ? `${paciente.edad} años` : null },
          { label: "Sexo", value: paciente.sexo && paciente.sexo !== "N" ? getSexoLabel(paciente.sexo) : null },
          { label: "Ocupación", value: paciente.ocupacion_laboral },
          { label: "Previsión de salud", value: paciente.prevision },
          { label: "Nacionalidad", value: paciente.nacionalidad },
          { label: "Religión", value: paciente.religion },
          { label: "Dirección", value: paciente.direccion },
          { label: "Comuna", value: paciente.comuna },
        ]}
      />
      <Seccion
        title="Información clínica"
        onEdit={onEdit}
        campos={[
          { label: "Frecuencia de atención", value: paciente.frecuencia_atencion },
          { label: "Origen de la consulta", value: paciente.origen_consulta },
          { label: "Diagnóstico sospechado", value: paciente.diagnostico_sospechado },
          { label: "Medicación actual", value: paciente.medicacion_actual },
          { label: "Derivación / interconsulta", value: paciente.derivacion_interconsulta, wide: true },
        ]}
      />
      <Seccion
        title="Riesgo y responsable"
        onEdit={onEdit}
        campos={[
          { label: "Riesgo suicida", value: paciente.riesgo_suicida ? "Sí" : "No" },
          { label: "Nivel de ideación suicida", value: paciente.ideacion_suicida_nivel ? `${paciente.ideacion_suicida_nivel}/5` : null },
          { label: "Menor de edad", value: paciente.es_menor_edad ? "Sí" : "No" },
          { label: "Tutor o responsable", value: paciente.nombre_tutor },
          { label: "Teléfono del tutor", value: paciente.telefono_tutor },
        ]}
      />

      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Notas privadas</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Solo visible para ti — no se comparte con el paciente.
            </p>
          </div>
          {paciente.notas_privadas && (
            <Button variant="ghost" size="sm" onClick={() => setMostrarNotas((v) => !v)} aria-expanded={mostrarNotas}>
              {mostrarNotas ? <EyeOff /> : <Eye />}
              {mostrarNotas ? "Ocultar" : "Mostrar"}
            </Button>
          )}
        </div>
        {paciente.notas_privadas ? (
          mostrarNotas && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{paciente.notas_privadas}</p>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 text-sm text-muted-foreground/80 underline-offset-2 hover:text-primary hover:underline"
          >
            Sin notas. Agregar
          </button>
        )}
      </section>
    </div>
  );
}
