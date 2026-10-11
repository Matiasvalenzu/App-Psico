import Link from "next/link";
import { AlertTriangle } from "lucide-react";

// Aviso no bloqueante: el profesional puede continuar sin consentimiento vigente.
export default function AvisoConsentimiento({
  pacienteId,
  mensaje,
  className = "",
}: {
  pacienteId: number | string;
  mensaje: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={`flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        El paciente no tiene consentimiento informado vigente. {mensaje}{" "}
        <Link href={`/dashboard/pacientes/${pacienteId}`} className="font-semibold underline underline-offset-2">
          Gestionar consentimiento
        </Link>
      </p>
    </div>
  );
}
