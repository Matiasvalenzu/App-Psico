"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import UpsellPlusModal from "./UpsellPlusModal";
import type { OrigenUpsell } from "@/lib/upsell";

export default function CobrosBloqueados({
  origen,
  enPrueba = false,
  compacto = false,
}: {
  origen: OrigenUpsell;
  enPrueba?: boolean;
  compacto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 p-4">
      <div className="pointer-events-none select-none blur-sm" aria-hidden="true">
        {compacto ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Debe $45.000 · 2 cobros</span>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
              <p className="text-xs text-muted-foreground">Pendiente del mes</p>
              <p className="text-xl font-semibold">$45.000</p>
              <p className="text-xs text-muted-foreground">2 cobros</p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
              <p className="text-xs text-muted-foreground">Pagado en el mes</p>
              <p className="text-xl font-semibold">$120.000</p>
              <p className="text-xs text-muted-foreground">1 cobro</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Te deben más</p>
              <p className="text-sm">Ana Rojas · $45.000</p>
            </div>
          </div>
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Button type="button" size="sm" variant="outline" className="gap-2 bg-background" onClick={() => setOpen(true)}>
          <Lock className="h-4 w-4" />
          Plan Plus
        </Button>
      </div>
      <UpsellPlusModal open={open} onOpenChange={setOpen} origen={origen} enPrueba={enPrueba} />
    </div>
  );
}
