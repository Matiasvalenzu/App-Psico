import { CheckCircle2, Clock, FileSignature, Mail, MessageCircle, Phone } from "lucide-react";
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
}: {
  paciente: Paciente;
  ultimaSesion: Sesion | null;
  onConsent: () => void;
  onEdit: () => void;
}) {
  const estado = paciente.consentimiento_estado;
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
            ? `Firmado electrónicamente${paciente.consentimiento_fecha_firma ? ` el ${formatDateCL(paciente.consentimiento_fecha_firma)}` : ""} (Ley 19.628).`
            : estado === "ENVIADO"
            ? "Enviado por correo; esperando la firma del paciente."
            : "Genera el documento con los datos del paciente para revisarlo, enviarlo y firmarlo."}
        </p>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onConsent}>
          {estado === "FIRMADO" ? "Ver consentimiento" : "Gestionar consentimiento"}
        </Button>
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
