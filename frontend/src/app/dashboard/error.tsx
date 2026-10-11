"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Alert variant="destructive" className="items-start">
      <AlertTriangle />
      <div className="flex-1">
        <AlertTitle>Algo salió mal al cargar esta sección</AlertTitle>
        <AlertDescription>
          Tus datos no se han perdido. Intenta de nuevo; si el problema continúa, recarga la página.
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
          <RotateCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </Alert>
  );
}
