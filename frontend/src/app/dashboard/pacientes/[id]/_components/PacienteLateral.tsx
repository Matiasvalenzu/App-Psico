import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileSignature, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateCL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Paciente, Sesion } from "./utils";

function Fila({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm">{children}</dd>
      </div>
    </div>
  );
}

// Columna lateral: consentimiento, contacto y actividad reciente. En móvil se muestra sobre las pestañas.
export default function PacienteLateral({
  paciente,
  ultimaSesion,
  onConsent,
  onEdit,
  onUpdated,
}: {
  paciente: Paciente;
  ultimaSesion: Sesion | null;
  onConsent: () => void;
  onEdit: () => void;
  onUpdated: () => void;
}) {
  const estado = paciente.consentimiento_estado;
  const papel = estado !== "FIRMADO" ? paciente.consentimiento_papel_fecha : null;
  const [registrando, setRegistrando] = useState(false);
  const [fechaPapel, setFechaPapel] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [guardando, setGuardando] = useState(false);

  async function guardarPapel(metodo: "POST" | "DELETE") {
    setGuardando(true);
    try {
      const res = await apiFetch(`/pacientes/${paciente.id}/consentimiento/papel/`, {
        method: metodo,
        body: metodo === "POST" ? JSON.stringify({ fecha: fechaPapel }) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.fecha?.[0] || "No se pudo guardar.");
      }
      setRegistrando(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }
  const emergencia = [paciente.contacto_emergencia_nombre, paciente.contacto_emergencia_telefono]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            Consentimiento informado
          </h2>
          {estado === "FIRMADO" ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
              <CheckCircle2 />
              Firmado
            </Badge>
          ) : papel ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
              <CheckCircle2 />
              En papel
            </Badge>
          ) : estado === "ENVIADO" ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              <Clock />
              Pendiente
            </Badge>
          ) : (
            <Badge variant="outline">No generado</Badge>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {estado === "FIRMADO"
            ? `Firmado electrónicamente${paciente.consentimiento_fecha_firma ? ` el ${formatDateCL(paciente.consentimiento_fecha_firma)}` : ""}.`
            : papel
            ? `Registraste un consentimiento firmado fuera de Psiconex el ${formatDateCL(papel)}.`
            : estado === "ENVIADO"
            ? "Enviado por correo; esperando la firma del paciente."
            : "Genera el documento con los datos del paciente para revisarlo, enviarlo y firmarlo."}
        </p>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onConsent}>
          {estado === "FIRMADO" ? "Ver consentimiento" : "Gestionar consentimiento"}
        </Button>
        {papel ? (
          <button
            type="button"
            disabled={guardando}
            onClick={() => guardarPapel("DELETE")}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Quitar registro en papel
          </button>
        ) : estado !== "FIRMADO" && (
          <>
            <p className="mt-3 flex gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Puedes grabar sin consentimiento, pero esas sesiones quedarán registradas como procesadas sin él.
            </p>
            {registrando ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={fechaPapel}
                  max={new Date().toLocaleDateString("en-CA")}
                  onChange={(e) => setFechaPapel(e.target.value)}
                  aria-label="Fecha de firma en papel"
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                />
                <Button size="sm" disabled={guardando || !fechaPapel} onClick={() => guardarPapel("POST")}>
                  Guardar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRegistrando(true)}
                className="mt-2 w-full text-xs font-medium text-primary hover:underline"
              >
                Registrar consentimiento en papel
              </button>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Contacto</h2>
        <dl className="mt-3 space-y-3">
          <Fila icon={<MessageCircle />} label="WhatsApp">
            {paciente.telefono_whatsapp ? (
              <a
                href={`https://wa.me/${paciente.telefono_whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {paciente.telefono_whatsapp}
              </a>
            ) : (
              <button type="button" onClick={onEdit} className="text-muted-foreground/80 hover:text-primary hover:underline">
                Sin completar
              </button>
            )}
          </Fila>
          <Fila icon={<Mail />} label="Correo">
            {paciente.email_contacto ? (
              <a href={`mailto:${paciente.email_contacto}`} className="text-primary hover:underline">
                {paciente.email_contacto}
              </a>
            ) : (
              <button type="button" onClick={onEdit} className="text-muted-foreground/80 hover:text-primary hover:underline">
                Sin completar
              </button>
            )}
          </Fila>
          <Fila icon={<Phone />} label="Contacto de emergencia">
            {emergencia || (
              <button type="button" onClick={onEdit} className="text-muted-foreground/80 hover:text-primary hover:underline">
                Sin completar
              </button>
            )}
          </Fila>
          <Fila icon={<Clock />} label="Última sesión">
            {ultimaSesion ? formatDate(ultimaSesion.fecha_hora_inicio) : "Sin sesiones"}
          </Fila>
        </dl>
      </section>
    </div>
  );
}
