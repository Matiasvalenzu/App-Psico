"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, Clock, Copy, ExternalLink, KeyRound, Loader2, Receipt, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { formatDateCL } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type EstadoDelegacion =
  | "NO_INICIADA"
  | "PENDIENTE_VERIFICACION"
  | "ACTIVA"
  | "POR_VENCER"
  | "VENCIDA"
  | "REVOCADA"
  | "ERROR";

interface Delegacion {
  estado: EstadoDelegacion;
  rut_emisor: string;
  fecha_otorgada: string | null;
  fecha_vencimiento: string | null;
  numero_transaccion: string;
  rut_autorizar: string;
  mensaje_bloqueo: string;
}

const PORTAL_SII = "https://www.sii.cl/servicios_online/1040-1287.html";
// Así lo imprime el SII en el comprobante (mayúsculas, sin tildes): el psicólogo lo reconoce tal cual.
const NOMBRE_EN_SII = "SOCIEDAD DE PROFESIONALES INFORMATICA Y TECNOLOGIA LIMITADA";

const ETIQUETAS: Record<EstadoDelegacion, string> = {
  NO_INICIADA: "Sin autorizar",
  PENDIENTE_VERIFICACION: "Pendiente de verificación",
  ACTIVA: "Activa",
  POR_VENCER: "Por vencer",
  VENCIDA: "Vencida",
  REVOCADA: "Revocada",
  ERROR: "Con problemas",
};

export default function BoletasAutomaticasPage() {
  const router = useRouter();
  const [delegacion, setDelegacion] = useState<Delegacion | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const res = await apiFetch("/facturacion/delegacion/");
    if (res.ok) setDelegacion(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user.boletas_habilitadas || !user.bhe_auto_disponible) {
          router.replace("/dashboard/configuracion/perfil");
          return;
        }
        return cargar();
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!delegacion) {
    return <Alert variant="destructive"><AlertDescription>No pudimos cargar el estado de la autorización. Intenta de nuevo más tarde.</AlertDescription></Alert>;
  }

  const { estado } = delegacion;
  const renovar = estado === "POR_VENCER" || estado === "VENCIDA";
  const autorizar = estado === "NO_INICIADA" || estado === "REVOCADA" || estado === "ERROR";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Receipt className="h-6 w-6 text-primary" />Emisión automática de boletas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Con tu autorización en el SII, Psiconex emite por ti las boletas de honorarios que tú confirmes, una por una.
        </p>
      </div>

      <Alert variant="success">
        <KeyRound />
        <AlertTitle>Psiconex nunca te pedirá tu clave del SII</AlertTitle>
        <AlertDescription>
          Tú autorizas a Psiconex desde tu propia cuenta del SII y puedes revocarlo cuando quieras. Ninguna pantalla de Psiconex te pedirá tu clave.
        </AlertDescription>
      </Alert>

      <EstadoActual delegacion={delegacion} />

      {estado !== "ACTIVA" && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            La emisión con el SII sigue apagada mientras la autorización no esté activa. Puedes seguir emitiendo a mano como hasta ahora.
          </AlertDescription>
        </Alert>
      )}

      {(autorizar || renovar) && (
        delegacion.rut_autorizar
          ? <Autorizacion delegacion={delegacion} renovar={renovar} onListo={cargar} />
          : <Alert><AlertDescription>La emisión automática todavía no está disponible. Te avisaremos cuando puedas activarla.</AlertDescription></Alert>
      )}

      {delegacion.rut_autorizar && <ComoRevocar />}
    </div>
  );
}

function EstadoActual({ delegacion }: { delegacion: Delegacion }) {
  const { estado } = delegacion;
  const icono = estado === "ACTIVA"
    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
    : estado === "PENDIENTE_VERIFICACION" ? <Clock className="h-5 w-5 text-primary" /> : <TriangleAlert className="h-5 w-5 text-amber-600" />;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2">{icono}<h2 className="font-semibold">Estado: {ETIQUETAS[estado]}</h2></div>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        {estado === "NO_INICIADA" && <p>Todavía no autorizas a Psiconex en el SII. Sigue los pasos de abajo.</p>}
        {estado === "PENDIENTE_VERIFICACION" && (
          <p>Estamos verificando la autorización en el SII. Te avisaremos cuando quede activa; mientras tanto no tienes que hacer nada.</p>
        )}
        {estado === "ACTIVA" && (
          <p>
            Tu autorización está activa{delegacion.fecha_vencimiento && <> hasta el {formatDateCL(delegacion.fecha_vencimiento)}</>}.
            Ya puedes emitir boletas con el SII desde los cobros de tus pacientes.
          </p>
        )}
        {estado === "POR_VENCER" && (
          <p>Tu autorización vence el {formatDateCL(delegacion.fecha_vencimiento)}. Renuévala en el SII y avísanos aquí abajo.</p>
        )}
        {estado === "VENCIDA" && <p>Tu autorización venció. Renuévala en el SII y avísanos aquí abajo.</p>}
        {estado === "REVOCADA" && <p>La autorización anterior ya no está vigente. Si quieres volver a usar la emisión automática, autoriza de nuevo.</p>}
        {estado === "ERROR" && <p>No pudimos usar la autorización anterior en el SII. Revisa que siga vigente o vuelve a autorizar.</p>}
        {estado === "ACTIVA" && delegacion.mensaje_bloqueo && <p className="text-amber-700 dark:text-amber-400">{delegacion.mensaje_bloqueo}</p>}
        {delegacion.fecha_otorgada && estado !== "NO_INICIADA" && <p>Autorizada el {formatDateCL(delegacion.fecha_otorgada)}.</p>}
        {delegacion.numero_transaccion && estado !== "NO_INICIADA" && <p>Número de transacción del SII: {delegacion.numero_transaccion}</p>}
      </div>
    </section>
  );
}

function Autorizacion({ delegacion, renovar, onListo }: { delegacion: Delegacion; renovar: boolean; onListo: () => Promise<void> }) {
  const [acepta, setAcepta] = useState(false);
  const [numeroTransaccion, setNumeroTransaccion] = useState("");
  const [rut, setRut] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [cuerpo, dv] = delegacion.rut_autorizar.replace(/\./g, "").split("-");

  async function enviar() {
    setEnviando(true);
    setErrores({});
    const res = await apiFetch("/facturacion/delegacion/", {
      method: "POST",
      body: JSON.stringify({
        acepta,
        numero_transaccion: numeroTransaccion.trim(),
        ...(!delegacion.rut_emisor && { rut: rut.trim() }),
      }),
    });
    setEnviando(false);
    if (res.ok) {
      toast.success("Listo. Vamos a verificar la autorización en el SII.");
      await onListo();
      return;
    }
    const data = await res.json().catch(() => ({}));
    const campos: Record<string, string> = {};
    for (const [campo, valor] of Object.entries(data)) {
      campos[campo] = Array.isArray(valor) ? String(valor[0]) : String(valor);
    }
    setErrores(campos);
    toast.error(campos.detail || "Revisa los datos marcados.");
  }

  return (
    <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <h2 className="font-semibold">{renovar ? "Renueva la autorización en el SII" : "Autoriza a Psiconex en el SII"}</h2>
      {renovar && (
        <p className="text-sm text-muted-foreground">Repite en el SII los mismos pasos con que autorizaste a Psiconex y luego vuelve aquí.</p>
      )}

      <ol className="space-y-5 text-sm">
        <Paso n={1}>
          Entra al portal de boletas de honorarios del SII con tu RUT y tu clave (en el sitio del SII, no en Psiconex).
          <a href={PORTAL_SII} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 font-medium text-primary hover:underline">
            Abrir el SII <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <span className="mt-1 block text-muted-foreground">Ruta: Servicios online › Boletas de honorarios electrónicas › Emisor de boleta de honorarios.</span>
        </Paso>
        <Paso n={2}>Abre la sección <b>Delegar</b> y elige <b>«Autorizar o revocar a un usuario autorizado»</b>.</Paso>
        <Paso n={3}>Haz clic en <b>«Autorizar usuarios»</b>.</Paso>
        <Paso n={4}>
          En «RUT usuario autorizado» copia estos dos datos (el SII los pide en casillas separadas):
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Copiable label="RUT sin dígito verificador" value={cuerpo} />
            <Copiable label="Dígito verificador" value={dv} />
          </div>
        </Paso>
        <Paso n={5}>
          Elige tu dirección, completa tu teléfono (el fax es opcional) y presiona <b>«Confirmar»</b>.
          <Captura src="/bhe/autorizar-01-formulario-lleno.png" alt="Formulario de autorización del SII con el RUT de la empresa que opera Psiconex" width={360} height={241} />
        </Paso>
        <Paso n={6}>
          El SII muestra el comprobante con <b>{NOMBRE_EN_SII}</b>, R.U.T. {delegacion.rut_autorizar}: es la empresa que opera Psiconex.
          Arriba a la derecha sale el número de transacción.
          <Captura src="/bhe/autorizar-02-resultado.png" alt="Comprobante del SII con el número de transacción y el nombre de la empresa que opera Psiconex" width={366} height={278} />
        </Paso>
      </ol>

      <div className="space-y-4 border-t pt-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Número de transacción (opcional)</span>
          <input
            inputMode="numeric"
            value={numeroTransaccion}
            onChange={(event) => setNumeroTransaccion(event.target.value.replace(/\D/g, ""))}
            placeholder="Ej.: 45778282851"
            maxLength={20}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <span className="mt-1.5 block text-xs text-muted-foreground">Lo trae tu comprobante del SII. Nos ayuda a verificar más rápido.</span>
          {errores.numero_transaccion && <span className="mt-1 block text-xs text-red-600">{errores.numero_transaccion}</span>}
        </label>

        {!delegacion.rut_emisor && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Tu RUT</span>
            <input
              value={rut}
              onChange={(event) => setRut(event.target.value)}
              placeholder="12.345.678-9"
              maxLength={12}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">Las boletas se emiten a tu nombre. Quedará fijo en tu perfil.</span>
            {errores.rut && <span className="mt-1 block text-xs text-red-600">{errores.rut}</span>}
          </label>
        )}

        {/* Borrador del consentimiento (versión 2026-10-borrador): falta la revisión del abogado. */}
        <label className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <input type="checkbox" checked={acepta} onChange={(event) => setAcepta(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
          <span className="space-y-2">
            <span className="block">Autorizo a la empresa que opera Psiconex (RUT {delegacion.rut_autorizar}) como usuario autorizado en el SII para emitir boletas de honorarios a mi nombre. Entiendo que:</span>
            <span className="block">• Psiconex solo emite las boletas que yo confirme, una por una.</span>
            <span className="block">• El usuario autorizado del SII solo puede emitir boletas: no puede anularlas ni ver mis otros datos tributarios.</span>
            <span className="block">• Psiconex no conoce ni guarda mi clave del SII.</span>
            <span className="block">• Cada boleta emitida es un documento tributario real.</span>
            <span className="block">• Puedo revocar la autorización cuando quiera desde el SII.</span>
          </span>
        </label>
        {errores.acepta && <p className="text-xs text-red-600">{errores.acepta}</p>}

        <div className="flex justify-end">
          <Button onClick={enviar} disabled={!acepta || enviando}>
            {enviando && <Loader2 className="animate-spin" />}
            {renovar ? "Ya la renové" : "Ya lo autoricé"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ComoRevocar() {
  return (
    <details className="group rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">Cómo revocar la autorización</summary>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p>
          En el SII, entra a Emisor de boleta de honorarios › <b>Delegar</b> › «Autorizar o revocar a un usuario autorizado» › <b>«Eliminar usuarios»</b>.
          Marca a {NOMBRE_EN_SII} y presiona <b>«Eliminar»</b>.
        </p>
        <p>Desde ese momento Psiconex ya no puede emitir boletas a tu nombre.</p>
        <Captura src="/bhe/autorizar-03-eliminar-usuarios-tras-autorizar.png" alt="Pantalla del SII para eliminar usuarios autorizados" width={360} height={149} />
      </div>
    </details>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{n}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function Captura({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return <Image src={src} alt={alt} width={width} height={height} className="mt-2 h-auto max-w-full rounded-lg border" />;
}

function Copiable({ label, value }: { label: string; value: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-base font-semibold">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={copiar} aria-label={`Copiar ${label}`}><Copy /></Button>
    </div>
  );
}
