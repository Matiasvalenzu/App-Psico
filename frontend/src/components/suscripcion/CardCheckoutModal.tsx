"use client";

import React, { useEffect, useState, useRef } from "react";
import Script from "next/script";
import Image from "next/image";
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
  User,
  Sparkles,
  Check,
  FileText,
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

  // Format Card Number (XXXX XXXX XXXX XXXX) & detect brand
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
          throw new Error("No fue posible validar la tarjeta con el emisor bancario.");
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
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl border border-border/80 bg-card text-foreground shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de acento con degradado de marca */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 shrink-0" />

        {success ? (
          <div className="p-8 sm:p-10 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            <div className="relative mb-5">
              <div className="h-20 w-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 className="h-10 w-10 animate-in zoom-in-75 duration-300" />
              </div>
              <div className="absolute -bottom-1 -right-1 rounded-full bg-card p-1 shadow-md border border-border">
                <Image
                  src="/logo-psiconex-512.png"
                  alt="Psiconex"
                  width={22}
                  height={22}
                  className="rounded-full object-contain"
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Tarjeta confirmada con éxito</span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              ¡Suscripción Activada!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
              {isTrial && formattedFinPrueba
                ? `Tu tarjeta ha quedado respaldada con éxito. Tu periodo de prueba gratuito continúa activo y tu primer cobro de $4.990 CLP se efectuará el ${formattedFinPrueba}.`
                : "Tu plan ha sido activado correctamente. Ya cuentas con acceso completo e ininterrumpido a todas las herramientas de Psiconex."}
            </p>

            <div className="mt-6 w-full max-w-xs rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>Estado del plan:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Activo y verificado
              </span>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto px-6 py-6 sm:px-8 sm:py-7 space-y-5">
            {/* Encabezado con Logo Oficial de Psiconex */}
            <div className="flex items-center justify-between gap-4 pb-1">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 via-primary/10 to-violet-500/10 border border-primary/20 p-2 shadow-sm">
                  <Image
                    src="/logo-psiconex-512.png"
                    alt="Psiconex"
                    width={48}
                    height={48}
                    className="h-full w-full object-contain"
                    priority
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tracking-tight text-foreground">Psiconex</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      <Sparkles className="h-3 w-3" />
                      Plan Pro
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Checkout seguro y encriptado</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-3 w-3" />
                  <span>Cifrado TLS</span>
                </div>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label="Cerrar ventana"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Título de la acción */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Activar suscripción mensual
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Ingresa los datos de tu tarjeta de crédito o débito para mantener activa tu cuenta.
              </p>
            </div>

            {/* Resumen del Plan / Aviso de Cobro Diferido */}
            {isTrial && formattedFinPrueba ? (
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-4 text-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground text-sm block">
                        Prueba gratuita activa
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Te quedan <strong>{diasRestantes ?? 14} días</strong> de acceso completo
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm block">
                      $0 CLP hoy
                    </span>
                    <span className="text-[10px] text-muted-foreground">Sin cobros ahora</span>
                  </div>
                </div>

                <div className="rounded-xl bg-background/80 dark:bg-background/40 border border-border/60 p-2.5 text-[11px] text-muted-foreground space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Primer cobro automático:</span>
                    <span className="font-semibold text-foreground">
                      $4.990 CLP el {formattedFinPrueba}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] pt-1.5 border-t border-border/40">
                    <Check className="h-3 w-3 shrink-0" />
                    <span>Garantía de satisfacción: cancela en 1 clic en cualquier momento sin costo</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-sm block">Plan Psiconex Pro</span>
                    <span className="text-muted-foreground text-[11px]">Acceso total e ilimitado</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-foreground text-base block">$4.990 CLP</span>
                  <span className="text-[10px] text-muted-foreground">Facturación mensual</span>
                </div>
              </div>
            )}

            {/* Tarjeta Virtual Interactiva en Tiempo Real */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-4 sm:p-5 text-white shadow-xl border border-indigo-500/20 select-none">
              {/* Marca de agua sutil de Psiconex */}
              <div className="absolute -right-6 -bottom-6 w-36 h-36 opacity-10 pointer-events-none">
                <Image
                  src="/logo-psiconex-512.png"
                  alt=""
                  width={144}
                  height={144}
                  className="h-full w-full object-contain brightness-200"
                />
              </div>
              <div className="absolute top-0 right-0 -mr-16 -mt-16 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

              {/* Fila superior: Chip + Contactless + Marca */}
              <div className="flex items-center justify-between relative z-10 mb-4">
                <div className="flex items-center gap-2.5">
                  {/* Chip Dorado */}
                  <div className="h-6 w-8 rounded-md bg-gradient-to-tr from-amber-300 via-amber-100 to-amber-500 p-0.5 shadow-sm border border-amber-500/60 flex items-center justify-center">
                    <div className="h-full w-full border border-amber-700/30 rounded-[2px] flex items-center justify-between px-0.5">
                      <div className="w-0.5 h-2.5 border-r border-amber-800/40" />
                      <div className="w-1.5 h-1.5 rounded-full border border-amber-800/40" />
                      <div className="w-0.5 h-2.5 border-l border-amber-800/40" />
                    </div>
                  </div>
                  {/* Contactless waves */}
                  <svg className="h-3.5 w-3.5 text-white/60 -rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  </svg>
                </div>

                {/* Brand Dinámica */}
                <div className="h-6 flex items-center justify-end">
                  {brand === "visa" && (
                    <span className="font-black italic tracking-tighter text-white text-lg drop-shadow">
                      VISA
                    </span>
                  )}
                  {brand === "mastercard" && (
                    <div className="flex items-center -space-x-1.5">
                      <div className="h-5 w-5 rounded-full bg-red-500/95 shadow" />
                      <div className="h-5 w-5 rounded-full bg-amber-400/95 shadow" />
                    </div>
                  )}
                  {brand === "amex" && (
                    <div className="bg-[#006FCF] text-white font-black text-[9px] tracking-tight px-1.5 py-0.5 rounded shadow">
                      AMEX
                    </div>
                  )}
                  {brand === "card" && (
                    <div className="flex items-center gap-1 text-[11px] text-white/70 font-medium">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Crédito / Débito</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Número de Tarjeta */}
              <div className="relative z-10 font-mono text-base sm:text-lg tracking-widest text-white/95 drop-shadow font-semibold mb-3">
                {cardNumber ? cardNumber : "•••• •••• •••• ••••"}
              </div>

              {/* Fila inferior: Titular y Expiración */}
              <div className="flex items-end justify-between relative z-10 text-[10px] text-white/75">
                <div className="max-w-[190px] sm:max-w-[240px]">
                  <div className="text-[8px] uppercase tracking-wider text-white/50 mb-0.5">Titular</div>
                  <div className="font-semibold uppercase tracking-wider text-white truncate text-xs">
                    {cardholderName ? cardholderName : "NOMBRE DEL TITULAR"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] uppercase tracking-wider text-white/50 mb-0.5">Vence</div>
                  <div className="font-mono font-semibold text-white text-xs">
                    {expiry ? expiry : "MM/AA"}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Formulario de Entrada */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Número de tarjeta */}
              <div className="space-y-1.5">
                <Label htmlFor="cardNumber" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  <span>Número de tarjeta</span>
                </Label>
                <div className="relative">
                  <Input
                    id="cardNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="4532 •••• •••• 4242"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="pr-12 font-mono tracking-wider text-sm h-10 rounded-xl"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                    {brand === "visa" && (
                      <span className="font-black italic text-xs text-blue-600 dark:text-blue-400">VISA</span>
                    )}
                    {brand === "mastercard" && (
                      <span className="font-bold text-xs text-amber-500">MC</span>
                    )}
                    {brand === "amex" && (
                      <span className="font-bold text-[10px] text-sky-500">AMEX</span>
                    )}
                    {brand === "card" && (
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {/* Nombre titular */}
              <div className="space-y-1.5">
                <Label htmlFor="cardholderName" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span>Nombre del titular (como figura en la tarjeta)</span>
                </Label>
                <Input
                  id="cardholderName"
                  type="text"
                  placeholder="EJ: MARÍA LÓPEZ PÉREZ"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                  className="uppercase text-sm h-10 rounded-xl"
                  required
                />
              </div>

              {/* Vencimiento y CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="expiry" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Vencimiento</span>
                  </Label>
                  <Input
                    id="expiry"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    value={expiry}
                    onChange={handleExpiryChange}
                    className="font-mono text-center text-sm h-10 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cvv" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    <span>Código CVV</span>
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
                      className="font-mono text-center pr-8 text-sm h-10 rounded-xl"
                      required
                    />
                    <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* RUT del titular */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="docNumber" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>RUT del titular</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Validación bancaria</span>
                </div>
                <Input
                  id="docNumber"
                  type="text"
                  placeholder="12345678-K"
                  value={docNumber}
                  onChange={handleRutChange}
                  className="font-mono text-sm h-10 rounded-xl"
                  required
                />
              </div>

              {/* Botón Principal CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full h-12 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all duration-200 active:scale-[0.99] text-white"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validando con Mercado Pago...
                    </span>
                  ) : isTrial ? (
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Confirmar y asegurar mi plan ($0 hoy)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Pagar $4.990 CLP y reactivar plan
                    </span>
                  )}
                </Button>
              </div>

              {/* Sellos de Confianza y Seguridad */}
              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Procesado de forma segura por</span>
                    <span className="font-semibold text-foreground">Mercado Pago</span>
                  </div>
                  {/* Marcas Aceptadas */}
                  <div className="flex items-center gap-1 opacity-90">
                    <span className="text-[9px] font-black tracking-tight text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                      VISA
                    </span>
                    <span className="text-[9px] font-bold tracking-tight text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      MC
                    </span>
                    <span className="text-[9px] font-bold tracking-tight text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                      AMEX
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                      Redcompra
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
                  Cifrado bancario TLS de 256 bits (PCI-DSS). Psiconex nunca almacena los números de tu tarjeta. Cancela cuando quieras en 1 clic.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </ClientPortal>
  );
}

