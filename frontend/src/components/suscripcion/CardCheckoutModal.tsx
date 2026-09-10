"use client";

import React, { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { ClientPortal } from "@/components/ui/ClientPortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import {
  CreditCard,
  Lock,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Calendar,
} from "lucide-react";

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

interface CardCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  userEmail: string;
  isTrial: boolean;
  finPrueba: string | null;
  diasRestantes: number | null;
  publicKey?: string;
}

export default function CardCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  isTrial,
  finPrueba,
  diasRestantes,
  publicKey,
}: CardCheckoutModalProps) {
  const [mpReady, setMpReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState(userEmail || "");
  const [brand, setBrand] = useState<string>("card");

  const mpInstance = useRef<any>(null);

  // Use provided public key or env fallback
  const mpPublicKey =
    publicKey ||
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ||
    "TEST-9b48b6cf-82e7-4b7b-91c6-14660eb684a0";

  useEffect(() => {
    if (typeof window !== "undefined" && window.MercadoPago && mpPublicKey) {
      try {
        mpInstance.current = new window.MercadoPago(mpPublicKey, {
          locale: "es-CL",
        });
        setMpReady(true);
      } catch (err) {
        console.error("Error inicializando Mercado Pago SDK:", err);
      }
    }
  }, [mpPublicKey, isOpen]);

  if (!isOpen) return null;

  // Format Card Number (XXXX XXXX XXXX XXXX) & guess brand
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);

    // Simple brand detection
    if (raw.startsWith("4")) {
      setBrand("visa");
    } else if (/^5[1-5]/.test(raw) || /^2[2-7]/.test(raw)) {
      setBrand("mastercard");
    } else if (/^3[47]/.test(raw)) {
      setBrand("amex");
    } else {
      setBrand("card");
    }
  };

  // Format Expiry (MM/AA)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setExpiry(raw);
  };

  // Format RUT (Chilean format: 12345678-K)
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
    if (clean.length > 1) {
      const cuerpo = clean.slice(0, -1);
      const dv = clean.slice(-1);
      setDocNumber(`${cuerpo}-${dv}`);
    } else {
      setDocNumber(clean);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cardNumber || cardNumber.replace(/\s/g, "").length < 15) {
      setError("Por favor ingresa un número de tarjeta válido.");
      return;
    }

    if (!cardholderName.trim()) {
      setError("Por favor ingresa el nombre del titular tal como figura en la tarjeta.");
      return;
    }

    const expiryParts = expiry.split("/");
    if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
      setError("Fecha de vencimiento inválida. Formato esperado: MM/AA.");
      return;
    }

    const expMonth = expiryParts[0];
    const expYear = `20${expiryParts[1]}`;

    if (!securityCode || securityCode.length < 3) {
      setError("Código de seguridad (CVV) incompleto.");
      return;
    }

    if (!docNumber) {
      setError("Por favor ingresa tu RUT o documento de identidad.");
      return;
    }

    setLoading(true);

    try {
      let cardTokenId = "";
      const rawCard = cardNumber.replace(/\s/g, "");
      const cleanDoc = docNumber.replace(/[^0-9kK]/g, "").toUpperCase();

      // Tokenizar mediante MercadoPago.js si está cargado
      if (mpInstance.current) {
        const tokenResponse = await mpInstance.current.createCardToken({
          cardNumber: rawCard,
          cardholderName: cardholderName.trim(),
          cardExpirationMonth: expMonth,
          cardExpirationYear: expYear,
          securityCode: securityCode,
          identificationType: "RUT",
          identificationNumber: cleanDoc,
        });

        if (tokenResponse && tokenResponse.id) {
          cardTokenId = tokenResponse.id;
        } else {
          throw new Error("No fue posible validar la tarjeta con el emisor.");
        }
      } else {
        // Modo fallback en caso de retraso del script
        cardTokenId = `tok_client_${Date.now()}`;
      }

      // Enviar token al backend de Psiconex
      const res = await apiFetch("/suscripciones/contratar/", {
        method: "POST",
        body: JSON.stringify({
          token: cardTokenId,
          payment_method_id: brand !== "card" ? brand : "visa",
          card_last_four: rawCard.slice(-4),
          payer_email: email || userEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || data?.detail || "No pudimos procesar la tarjeta. Revisa los datos ingresados."
        );
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess(data);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error("Error al contratar suscripción:", err);
      setError(err?.message || "Ocurrió un error inesperado al procesar tu suscripción.");
    } finally {
      setLoading(false);
    }
  };

  const formattedFinPrueba = finPrueba
    ? new Date(finPrueba).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <ClientPortal>
      {/* Mercado Pago SDK Script Loader */}
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== "undefined" && window.MercadoPago && mpPublicKey) {
            try {
              mpInstance.current = new window.MercadoPago(mpPublicKey, {
                locale: "es-CL",
              });
              setMpReady(true);
            } catch (err) {
              console.error("Error cargando MercadoPago.js:", err);
            }
          }
        }}
      />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Cerrar ventana"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400 mb-4 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="h-14 w-14" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">¡Suscripción Activada!</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
              {isTrial && formattedFinPrueba
                ? `Tu tarjeta quedó registrada con éxito. Tu primer cobro se realizará el ${formattedFinPrueba}.`
                : "Tu plan ha sido activado correctamente. Ya tienes acceso continuo a Psiconex."}
            </p>
          </div>
        ) : (
          <>
            {/* Header del modal */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Plan Estándar Psiconex</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Activar suscripción mensual
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ingresa los datos de tu tarjeta de crédito o débito para mantener activa tu cuenta.
              </p>
            </div>

            {/* Aviso transparente de cobro diferido */}
            {isTrial && formattedFinPrueba ? (
              <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-primary block">
                    Sin cobros hoy: prueba gratuita vigente
                  </span>
                  <span className="text-muted-foreground leading-relaxed block mt-0.5">
                    Te quedan <strong>{diasRestantes ?? 14} días de prueba</strong>. Tu primer cobro de <strong>$4.990 CLP</strong> se efectuará automáticamente el <strong>{formattedFinPrueba}</strong>. Puedes cancelar en cualquier momento antes sin costo.
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-center justify-between">
                <span>Total a debitar:</span>
                <span className="font-bold text-foreground text-sm">$4.990 CLP / mes</span>
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Número de tarjeta */}
              <div className="space-y-1.5">
                <Label htmlFor="cardNumber" className="text-xs font-medium">
                  Número de tarjeta
                </Label>
                <div className="relative">
                  <Input
                    id="cardNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="4532 •••• •••• 4242"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="pr-10 font-mono tracking-wider text-sm"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground uppercase text-[10px] font-bold">
                    {brand !== "card" ? (
                      <span className="text-primary font-bold">{brand}</span>
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Nombre titular */}
              <div className="space-y-1.5">
                <Label htmlFor="cardholderName" className="text-xs font-medium">
                  Nombre del titular (como figura en la tarjeta)
                </Label>
                <Input
                  id="cardholderName"
                  type="text"
                  placeholder="Ej: MARÍA LÓPEZ PÉREZ"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                  className="uppercase text-sm"
                  required
                />
              </div>

              {/* Vencimiento y CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="expiry" className="text-xs font-medium">
                    Vencimiento (MM/AA)
                  </Label>
                  <Input
                    id="expiry"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    value={expiry}
                    onChange={handleExpiryChange}
                    className="font-mono text-center text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cvv" className="text-xs font-medium">
                    Código de seguridad (CVV)
                  </Label>
                  <div className="relative">
                    <Input
                      id="cvv"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="123"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="font-mono text-center pr-8 text-sm"
                      required
                    />
                    <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* RUT del titular */}
              <div className="space-y-1.5">
                <Label htmlFor="docNumber" className="text-xs font-medium">
                  RUT del titular de la cuenta
                </Label>
                <Input
                  id="docNumber"
                  type="text"
                  placeholder="12345678-K"
                  value={docNumber}
                  onChange={handleRutChange}
                  className="font-mono text-sm"
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full h-11 text-sm font-semibold shadow-lg shadow-primary/20"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando con Mercado Pago...
                    </span>
                  ) : isTrial ? (
                    "Confirmar y asegurar mi plan"
                  ) : (
                    "Pagar $4.990 CLP y reactivar"
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>Procesado de forma segura y encriptada por Mercado Pago. Cancela cuando quieras.</span>
              </div>
            </form>
          </>
        )}
      </div>
    </ClientPortal>
  );
}
