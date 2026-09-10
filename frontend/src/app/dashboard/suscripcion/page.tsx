"use client";

import { useEffect, useState, useCallback } from "react";
import { getCurrentUser, apiFetch } from "@/lib/api";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CardCheckoutModal from "@/components/suscripcion/CardCheckoutModal";

export default function SuscripcionPage() {
  const [user, setUser] = useState<any>(null);
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [userData, subRes] = await Promise.all([
        getCurrentUser(),
        apiFetch("/suscripciones/estado/"),
      ]);
      setUser(userData);

      if (subRes.ok) {
        const subJson = await subRes.json();
        setSubData(subJson);
      }
    } catch (err) {
      console.error("Error al cargar datos de suscripción:", err);
      setError("No se pudo cargar la información actualizada de tu cuenta.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancelSubscription = async () => {
    setCancelling(true);
    setError("");
    try {
      const res = await apiFetch("/suscripciones/cancelar/", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Error al cancelar la suscripción.");
      }
      setSuccessMsg("Tu suscripción ha sido cancelada exitosamente. No se realizarán más cobros.");
      setConfirmCancel(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "No se pudo cancelar la suscripción. Intenta nuevamente.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Cargando estado de suscripción...
      </div>
    );
  }

  const estado = subData?.estado || user?.suscripcion_estado || "trial";
  const isExpired = estado === "expirada" || user?.suscripcion_activa === false;
  const isTrial = estado === "trial";
  const isActive = estado === "activa";
  const isCancelled = estado === "cancelada";

  const diasRestantes =
    subData?.dias_restantes_prueba ?? user?.dias_restantes_prueba ?? 0;
  const finPrueba = subData?.fin_prueba || user?.fin_prueba;
  const proximoCobro = subData?.proximo_cobro;

  const formattedFinPrueba = finPrueba
    ? new Date(finPrueba).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const formattedProximoCobro = proximoCobro
    ? new Date(proximoCobro).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Gestión de Facturación</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Mi Suscripción
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Administra tu plan, métodos de pago y el estado de tu acceso a Psiconex.
        </p>
      </div>

      {/* Alertas informativas */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Alerta de Período de Prueba Vencido */}
      {isExpired && (
        <div className="mb-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-foreground shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-destructive/20 p-2.5 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-destructive">
                Tu período de prueba ha finalizado
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tus pacientes, sesiones e informes clínicos están resguardados de forma 100% segura. Para continuar utilizando la asistencia de IA y desbloquear el acceso, activa tu suscripción al Plan Estándar.
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => setModalOpen(true)}
                  className="shadow-md shadow-destructive/20"
                >
                  Reactivar mi cuenta ($4.990 CLP/mes)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Trial Activo */}
      {isTrial && !isActive && (
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-foreground sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                  Período de prueba gratuito activo: {diasRestantes} {diasRestantes === 1 ? "día restante" : "días restantes"}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Disfrutas de todas las funcionalidades sin restricciones. Tu prueba finaliza el{" "}
                  <strong>{formattedFinPrueba || "próximamente"}</strong>. Puedes registrar tu tarjeta hoy para evitar interrupciones:{" "}
                  <span className="font-semibold text-foreground">no se cobrará nada hasta el fin de la prueba</span>.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/15 shrink-0"
            >
              Asegurar continuidad
            </Button>
          </div>
        </div>
      )}

      {/* Tarjeta de Resumen del Plan */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <div className="space-y-5 flex-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Plan Actual
              </span>
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Activo
                </span>
              )}
              {isTrial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Prueba 14 días
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                  Cancelado
                </span>
              )}
            </div>

            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Plan Estándar
              </h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-foreground">$4.990</span>
                <span className="text-sm text-muted-foreground">CLP / mes</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Herramienta integral de IA para psicólogos: sesiones clínicas, transcripción, diarización de hablantes y sincronización de agenda.
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> Sesiones clínicas ilimitadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> Transcripción y diarización
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> Integración con Google Calendar
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> Tests psicométricos automáticos
              </li>
            </ul>
          </div>

          {/* Panel Lateral de Acciones & Tarjeta */}
          <div className="flex flex-col items-stretch lg:items-end justify-between gap-6 border-t lg:border-t-0 lg:border-l border-border/60 pt-6 lg:pt-0 lg:pl-8 min-w-[280px]">
            {isActive ? (
              <div className="w-full space-y-4">
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2 text-left">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Suscripción Vigente
                  </div>
                  {subData?.card_last_four && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{subData.card_brand || "Tarjeta"}</span>
                      <span>•••• {subData.card_last_four}</span>
                    </div>
                  )}
                  {formattedProximoCobro && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Próxima renovación: <strong>{formattedProximoCobro}</strong></span>
                    </div>
                  )}
                </div>

                {!confirmCancel ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmCancel(true)}
                    className="w-full text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  >
                    Cancelar suscripción
                  </Button>
                ) : (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-2 text-left animate-in fade-in">
                    <p className="text-xs text-foreground font-medium">
                      ¿Seguro que deseas cancelar la renovación automática?
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                        className="text-xs h-8"
                      >
                        {cancelling ? "Cancelando..." : "Sí, cancelar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmCancel(false)}
                        disabled={cancelling}
                        className="text-xs h-8"
                      >
                        Volver
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-3">
                <Button
                  size="lg"
                  onClick={() => setModalOpen(true)}
                  className="w-full font-semibold shadow-lg shadow-primary/20 h-12 text-base"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isTrial ? "Activar suscripción" : "Reactivar plan"}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground leading-tight">
                  {isTrial
                    ? "Registra tu tarjeta sin cobro hoy. Cancela cuando quieras."
                    : "Acceso inmediato garantizado."}
                </p>
              </div>
            )}

            <div className="w-full pt-4 border-t border-border/50 text-left lg:text-right space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center lg:justify-end gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Cobro seguro vía Mercado Pago</span>
              </div>
              <div>Sin contratos ni cláusulas de permanencia.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de checkout con tarjeta */}
      <CardCheckoutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setSuccessMsg("¡Suscripción confirmada con éxito!");
          loadData();
        }}
        userEmail={user?.email || ""}
        isTrial={isTrial}
        finPrueba={finPrueba}
        diasRestantes={diasRestantes}
        publicKey={subData?.public_key}
      />
    </div>
  );
}
