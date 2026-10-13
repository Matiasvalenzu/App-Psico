"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import { getAccessToken } from "@/lib/api";
import { guardarPreapprovalPendiente, vincularPreapproval } from "@/lib/vincularPlus";

type Estado = "vinculando" | "listo" | "sin_sesion" | "error";

/** Al volver del enlace de Plus: activa el plan en la cuenta o lo deja pendiente hasta que inicie sesión. */
export function VincularPlus({ preapprovalId }: { preapprovalId: string }) {
  const [estado, setEstado] = useState<Estado>("vinculando");
  const [error, setError] = useState("");

  useEffect(() => {
    guardarPreapprovalPendiente(preapprovalId);
    if (!getAccessToken()) {
      setEstado("sin_sesion");
      return;
    }
    vincularPreapproval(preapprovalId).then((mensaje) => {
      if (mensaje) {
        setError(mensaje);
        setEstado("error");
      } else {
        setEstado("listo");
      }
    });
  }, [preapprovalId]);

  if (estado === "vinculando") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Activando el Plan Plus en tu cuenta...
      </div>
    );
  }
  if (estado === "listo") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        El Plan Plus quedó activo en tu cuenta.
      </div>
    );
  }
  if (estado === "sin_sesion") {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        Inicia sesión con la cuenta que usarás en Psiconex (o créala) y el Plan Plus se activará automáticamente.{" "}
        <Link href="/login" className="font-semibold underline underline-offset-2">
          Iniciar sesión o crear cuenta
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-left text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error} Si el cobro ya se hizo, escríbenos y lo activamos.</span>
    </div>
  );
}
