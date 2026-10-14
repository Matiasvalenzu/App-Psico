"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackUpsell, type OrigenUpsell } from "@/lib/upsell";

const BENEFICIOS = [
  "Emisión de boletas en un clic",
  "Seguimiento de pagos",
  "Quién te debe",
  "Retención calculada",
  "PDF y envío al paciente",
];

export default function UpsellPlusModal({
  open,
  onOpenChange,
  origen,
  enPrueba = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origen: OrigenUpsell;
  enPrueba?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (open) trackUpsell("upsell_plus_click", origen);
  }, [open, origen]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Función del Plan Plus
          </DialogTitle>
          <DialogDescription>Estas herramientas están incluidas en Plus.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm">
          {BENEFICIOS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-lg font-semibold">$9.990/mes</p>
        {enPrueba && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            El cobro de $9.990 parte de inmediato y los días de prueba que te quedan se pierden.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Ahora no
          </Button>
          <Button
            type="button"
            onClick={() => {
              trackUpsell("upsell_plus_cta", origen);
              onOpenChange(false);
              router.push("/dashboard/suscripcion");
            }}
          >
            Pasarme a Plus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
