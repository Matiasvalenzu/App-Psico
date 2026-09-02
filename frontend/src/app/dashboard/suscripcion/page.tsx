"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, apiFetch } from "@/lib/api";
import { CreditCard, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuscripcionPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (err) {
        setError("Error al cargar la información del usuario.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const res = await apiFetch("/suscripciones/checkout/", { method: "POST" });
      if (!res.ok) throw new Error("No se pudo iniciar el pago");
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error("No se devolvió un link de pago");
      }
    } catch (err) {
      setError("Error al procesar la suscripción. Intente nuevamente más tarde.");
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  const isExpired = user?.suscripcion_activa === false;
  const isTrial = user?.suscripcion_estado === "trial";
  const isActive = user?.suscripcion_estado === "activa";

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mi Suscripción</h1>
        <p className="text-muted-foreground mt-2">
          Administra tu plan y acceso a la plataforma Psiconex.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {isExpired && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-5 w-5" />
            Periodo de prueba finalizado
          </div>
          <p>
            Tu acceso a las funciones premium ha sido bloqueado. Para continuar usando Psiconex y acceder a tus pacientes y sesiones, por favor suscríbete al Plan Estándar.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Plan Estándar
            </div>
            <h2 className="text-4xl font-bold tracking-tight">
              $4.990 <span className="text-lg font-normal text-muted-foreground">CLP/mes</span>
            </h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Sesiones ilimitadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Transcripción y diarización
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Agenda con Google Calendar
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Tests psicológicos
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center sm:items-end gap-4 min-w-[200px]">
            {isActive ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400 w-full">
                Suscripción Activa
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={handleSubscribe}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Procesando..." : "Suscribirme ahora"}
              </Button>
            )}

            {isTrial && !isActive && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                Estás en periodo de prueba
              </div>
            )}

            {!isActive && (
              <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Pago seguro vía Mercado Pago
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
