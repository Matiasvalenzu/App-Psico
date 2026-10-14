"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentUser, apiFetch } from "@/lib/api";
import { cn, formatDateCL } from "@/lib/utils";
import { FUNCIONES_ESTANDAR, FUNCIONES_PLUS_ADMINISTRACION, NOTA_PLUS, TITULO_PLUS } from "@/lib/planes";
import { flushUpsell } from "@/lib/upsell";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  Stethoscope,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CardCheckoutModal from "@/components/suscripcion/CardCheckoutModal";

const pesos = (monto: number) => `$${monto.toLocaleString("es-CL")}`;

function ListaFunciones({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SuscripcionPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [planModal, setPlanModal] = useState("estandar");
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmCambio, setConfirmCambio] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [confirmPlusPrueba, setConfirmPlusPrueba] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [userData, subRes] = await Promise.all([
        getCurrentUser(),
        apiFetch("/suscripciones/estado/"),
      ]);
      setUser(userData);

      if (subRes.ok) {
        setSubData(await subRes.json());
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

  useEffect(() => {
    flushUpsell();
  }, []);

  useEffect(() => {
    if (loading || searchParams.get("activar") !== "plus" || !subData?.plan_plus_disponible) return;
    document.getElementById("plan-plus")?.scrollIntoView({ block: "center" });
    const estado = subData.estado || user?.suscripcion_estado;
    if (estado === "activa" && subData.plan === "estandar" && subData.mp_preapproval_id) {
      setConfirmCambio(true);
      return;
    }
    if (estado === "trial") {
      setConfirmPlusPrueba(true);
      return;
    }
    if (estado !== "activa") {
      setPlanModal("plus");
      setModalOpen(true);
    }
  }, [loading, searchParams, subData, user]);

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

  const handleCambiarPlan = async (plan: string) => {
    setCambiando(true);
    setError("");
    try {
      const res = await apiFetch("/suscripciones/cambiar-plan/", { method: "POST", body: JSON.stringify({ plan }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cambiar el plan.");
      }
      setSuccessMsg("Tu plan fue actualizado. El nuevo monto se aplica desde la próxima renovación.");
      setConfirmCambio(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "No se pudo cambiar el plan. Intenta nuevamente.");
    } finally {
      setCambiando(false);
    }
  };

  const abrirModal = (plan: string) => {
    setPlanModal(plan);
    setModalOpen(true);
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

  const plusDisponible = Boolean(subData?.plan_plus_disponible);
  const planes: Record<string, { nombre: string; monto: number }> =
    subData?.planes || { estandar: { nombre: "Plan Estándar", monto: 4990 } };
  const planActual: string = subData?.plan || "estandar";
  const montoEstandar = planes.estandar?.monto ?? 4990;
  const montoPlus = planes.plus?.monto ?? 9990;
  // Quien ya paga con tarjeta cambia el monto del mismo cobro; el enlace crearía una segunda suscripción.
  const puedeCambiarPlan = isActive && Boolean(subData?.mp_preapproval_id);
  const planDestino = planActual === "plus" ? "estandar" : "plus";

  const diasRestantes =
    subData?.dias_restantes_prueba ?? user?.dias_restantes_prueba ?? 0;
  const finPrueba = subData?.fin_prueba || user?.fin_prueba;
  const proximoCobro = subData?.proximo_cobro;

  const formattedFinPrueba = finPrueba ? formatDateCL(finPrueba) : null;
  const formattedProximoCobro = proximoCobro ? formatDateCL(proximoCobro) : null;

  const confirmacionCambio = (
    <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2 text-left animate-in fade-in">
      <p className="text-xs text-foreground font-medium">
        Desde la próxima renovación pagarás {pesos(planDestino === "plus" ? montoPlus : montoEstandar)} CLP/mes.
        {planDestino === "estandar" && " Tus cobros y boletas quedarán solo de lectura."}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => handleCambiarPlan(planDestino)} disabled={cambiando} className="text-xs h-8">
          {cambiando ? "Cambiando..." : "Confirmar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmCambio(false)} disabled={cambiando} className="text-xs h-8">
          Volver
        </Button>
      </div>
    </div>
  );

  const accionEstandar = () => {
    if (isActive && planActual === "estandar") {
      return <Button variant="outline" disabled className="w-full">Tu plan actual</Button>;
    }
    if (isActive) {
      if (!puedeCambiarPlan) return null;
      return confirmCambio && planDestino === "estandar" ? confirmacionCambio : (
        <Button variant="outline" onClick={() => setConfirmCambio(true)} className="w-full">
          Volver al Estándar ({pesos(montoEstandar)}/mes)
        </Button>
      );
    }
    return (
      <div className="space-y-2">
        <Button variant="outline" onClick={() => abrirModal("estandar")} className="w-full">
          <CreditCard className="mr-2 h-4 w-4" />
          {isTrial ? "Activar Estándar" : "Suscribirme al Estándar"}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground leading-tight">
          {isTrial ? "Registras tu tarjeta sin cobro hoy: el primer cobro es al terminar la prueba." : "El acceso se reactiva al confirmarse el pago."}
        </p>
      </div>
    );
  };

  const accionPlus = () => {
    if (isActive && planActual === "plus") {
      return <Button disabled className="w-full">Tu plan actual</Button>;
    }
    if (isActive) {
      if (!puedeCambiarPlan) return null;
      return confirmCambio && planDestino === "plus" ? confirmacionCambio : (
        <Button onClick={() => setConfirmCambio(true)} className="w-full font-semibold shadow-lg shadow-primary/20">
          Cambiar a Plus ({pesos(montoPlus)}/mes)
        </Button>
      );
    }
    if (isTrial && diasRestantes > 0 && !confirmPlusPrueba) {
      return (
        <Button onClick={() => setConfirmPlusPrueba(true)} className="w-full font-semibold shadow-lg shadow-primary/20">
          <CreditCard className="mr-2 h-4 w-4" />
          Suscribirme a Plus
        </Button>
      );
    }
    if (isTrial && diasRestantes > 0) {
      return (
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2 text-left animate-in fade-in">
          <p className="text-xs text-foreground font-medium">
            El cobro de {pesos(montoPlus)} CLP parte de inmediato y {diasRestantes === 1 ? "el día de prueba que te queda se pierde" : `los ${diasRestantes} días de prueba que te quedan se pierden`}.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="text-xs h-8" onClick={() => abrirModal("plus")}>
              Ir a pagar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmPlusPrueba(false)} className="text-xs h-8">
              Volver
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <Button onClick={() => abrirModal("plus")} className="w-full font-semibold shadow-lg shadow-primary/20">
          <CreditCard className="mr-2 h-4 w-4" />
          Suscribirme a Plus
        </Button>
        <p className="text-[11px] text-center text-muted-foreground leading-tight">
          Ingresas la tarjeta aquí. El primer cobro es al confirmar y Plus queda activo en esta cuenta.
        </p>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
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
                Tus pacientes, sesiones e informes clínicos siguen guardados y puedes consultarlos o exportarlos. Para continuar utilizando la asistencia de IA y desbloquear el acceso, elige un plan más abajo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Trial Activo */}
      {isTrial && !isActive && (
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-foreground sm:p-6 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                Período de prueba gratuito activo: {diasRestantes} {diasRestantes === 1 ? "día restante" : "días restantes"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Disfrutas de todas las funcionalidades clínicas sin restricciones. Tu prueba finaliza el{" "}
                <strong>{formattedFinPrueba || "próximamente"}</strong>. Elige tu plan para seguir sin interrupciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suscripción vigente */}
      {isActive && (
        <div className="mb-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Suscripción vigente · {planActual === "plus" ? "Plus" : "Estándar"}
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
          <div className="sm:w-56">
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
                  <Button size="sm" variant="destructive" onClick={handleCancelSubscription} disabled={cancelling} className="text-xs h-8">
                    {cancelling ? "Cancelando..." : "Sí, cancelar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling} className="text-xs h-8">
                    Volver
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Planes */}
      <div className={cn("grid gap-6 items-stretch", plusDisponible && "md:grid-cols-2")}>
        <div className="flex flex-col rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Estándar</h2>
            {isCancelled && planActual === "estandar" && (
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">Cancelado</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Todo lo clínico de tu consulta.</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-foreground">{pesos(montoEstandar)}</span>
            <span className="text-sm text-muted-foreground">CLP / mes</span>
          </div>
          <div className="mt-6 flex-1">
            <ListaFunciones items={FUNCIONES_ESTANDAR} />
          </div>
          <div className="mt-8">{accionEstandar()}</div>
        </div>

        {plusDisponible && (
          <div id="plan-plus" className="relative flex flex-col rounded-3xl border-2 border-primary bg-card p-6 sm:p-8 shadow-xl shadow-primary/10">
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
              <Sparkles className="h-3.5 w-3.5" />
              Recomendado
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Plus</h2>
              {isCancelled && planActual === "plus" && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">Cancelado</span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{TITULO_PLUS}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-foreground">{pesos(montoPlus)}</span>
              <span className="text-sm text-muted-foreground">CLP / mes</span>
            </div>
            <div className="mt-6 flex-1 space-y-5">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Stethoscope className="h-4 w-4 text-primary" /> Clínico
                </h3>
                <p className="text-sm text-muted-foreground">Todo lo del plan Estándar.</p>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Receipt className="h-4 w-4 text-primary" /> Administración y cobros
                </h3>
                <ListaFunciones items={FUNCIONES_PLUS_ADMINISTRACION} />
                <p className="mt-3 text-xs text-muted-foreground">{NOTA_PLUS}</p>
              </div>
            </div>
            <div className="mt-8">{accionPlus()}</div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Cobro seguro vía Mercado Pago
        </span>
        <span>Sin contratos ni cláusulas de permanencia.</span>
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
        plan={planModal}
        monto={planes[planModal]?.monto ?? montoEstandar}
        nombre={planModal === "plus" ? "Plan Plus" : "Plan Estándar"}
      />
    </div>
  );
}
