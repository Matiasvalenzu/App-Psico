import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { tieneRiesgo, type Paciente } from "./utils";

function contactoEmergencia(p: Paciente) {
  const partes = [p.contacto_emergencia_nombre, p.contacto_emergencia_telefono].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

// Alertas clínicas visibles bajo la identidad: riesgo (destructive) y menor de edad / tutor (warning).
export default function AlertaClinica({ paciente }: { paciente: Paciente }) {
  const riesgo = tieneRiesgo(paciente);
  const menor = paciente.es_menor_edad || Boolean(paciente.nombre_tutor);
  if (!riesgo && !menor) return null;

  const emergencia = contactoEmergencia(paciente);
  const tutor = [paciente.nombre_tutor, paciente.telefono_tutor].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3">
      {riesgo && (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Riesgo suicida registrado</AlertTitle>
          <AlertDescription>
            <p>
              {paciente.riesgo_suicida ? "Riesgo activo o relevante." : "Sin riesgo activo marcado."}
              {paciente.ideacion_suicida_nivel ? ` Nivel de ideación: ${paciente.ideacion_suicida_nivel}/5.` : ""}
            </p>
            <p>Contacto de emergencia: {emergencia || "sin registrar"}</p>
          </AlertDescription>
        </Alert>
      )}
      {menor && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>{paciente.es_menor_edad ? "Paciente menor de edad" : "Paciente con tutor o responsable"}</AlertTitle>
          <AlertDescription>
            <p>Tutor o responsable: {tutor || "sin registrar"}</p>
            {!riesgo && emergencia && <p>Contacto de emergencia: {emergencia}</p>}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
