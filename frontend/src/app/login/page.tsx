"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  login,
  loginWithGoogle,
  registerUser,
  verifyRegistrationCode,
  resendRegistrationCode,
} from "@/lib/api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Gift,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

// Mismos mensajes clave que la landing (marketing/)
const FEATURES = [
  {
    icon: AudioLines,
    title: "Transcripción y diarización clínica",
    description:
      "Distingue con precisión tu voz de la del paciente y entrega minutas estructuradas con marcas de tiempo.",
  },
  {
    icon: Fingerprint,
    title: "Biometría de voz avanzada",
    description: "Tu perfil de voz se entrena una vez. Después, la IA reconoce quién habla en cada sesión.",
  },
  {
    icon: FileText,
    title: "Informes y resúmenes en segundos",
    description:
      "Resúmenes de sesión, evolución, derivaciones e informes clínicos generados con IA y adaptados a tu plantilla.",
  },
];

const labelClass = "block text-sm font-medium text-foreground";
const inputClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 dark:bg-background/50";
const eyeButtonClass =
  "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground";
const submitClass =
  "group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_-10px_hsl(var(--primary)/0.7)] transition hover:bg-primary/90 hover:shadow-[0_14px_28px_-10px_hsl(var(--primary)/0.75)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();

  // Modo: 'login' | 'register'
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Estado Login
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Estado Registro - Paso 1 (Datos)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Estado Registro - Paso 2 (OTP)
  const [registerStep, setRegisterStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Estados generales UI
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  // Temporizador para reenvío de OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  function switchTab(tab: "login" | "register") {
    setActiveTab(tab);
    setError("");
    setSuccessMessage("");
    if (tab === "register") {
      setRegisterStep("form");
    }
  }

  // Submit Login
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      await login(loginIdentifier, loginPassword);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  // Submit Registro Paso 1: Enviar datos y recibir OTP
  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (registerPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (registerPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!acceptedTerms) {
      setError("Debes aceptar los Términos y la Política de Privacidad.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        first_name: firstName,
        last_name: lastName,
        email: registerEmail,
        password: registerPassword,
      });
      setRegisterStep("otp");
      setResendCooldown(60);
      setSuccessMessage(`Te enviamos un código de 6 dígitos a ${registerEmail}`);
    } catch (err: any) {
      setError(err.message || "Error al solicitar el registro.");
    } finally {
      setLoading(false);
    }
  }

  // Submit Registro Paso 2: Validar OTP e ingresar
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setError("Ingresa el código completo de 6 dígitos.");
      return;
    }

    setLoading(true);
    try {
      await verifyRegistrationCode(registerEmail, cleanCode);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Código inválido o expirado.");
    } finally {
      setLoading(false);
    }
  }

  // Reenviar OTP
  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      await resendRegistrationCode(registerEmail);
      setResendCooldown(60);
      setSuccessMessage("Nuevo código enviado exitosamente a tu correo.");
    } catch (err: any) {
      setError(err.message || "No se pudo reenviar el código.");
    } finally {
      setLoading(false);
    }
  }

  // Google OAuth Success
  async function handleGoogleSuccess(credentialResponse: any) {
    if (!credentialResponse.credential) {
      setError("No se recibió token de Google");
      return;
    }
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión con Google");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="theme-landing relative isolate min-h-screen overflow-hidden bg-background text-foreground">
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6 short:sm:top-4">
          <ThemeToggle />
        </div>

        {/* Fondo ambiental con el mismo lenguaje visual del hero de la landing */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-[hsl(280_75%_64%/0.08)]" />
          <div className="absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(var(--primary)/0.15),transparent)]" />
          <div
            className="absolute inset-0 opacity-[0.03] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div
            className="orb animate-float-slow -left-40 -top-24 size-[30rem] bg-primary/35"
            style={{ animationDelay: "-2s" }}
          />
          <div
            className="orb animate-float-slow -right-40 top-1/4 size-[36rem] bg-[hsl(280_75%_64%/0.3)]"
            style={{ animationDelay: "-8s" }}
          />
          <div className="orb -bottom-48 left-1/4 size-[26rem] bg-primary/20" />
        </div>

        <main className="mx-auto grid min-h-screen w-full max-w-7xl content-center items-center gap-8 px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-16 short:pb-6 short:pt-14">
          {/* Columna de marca: en móvil solo se muestra el logo */}
          <section className="motion-safe:animate-fade-in-up">
            <div className="flex justify-center lg:justify-start">
              <Image
                src="/logo-psiconex.png"
                alt="Psiconex"
                width={1951}
                height={393}
                className="h-11 w-auto dark:hidden sm:h-12 xl:h-14"
                priority
              />
              <Image
                src="/logo-psiconex-sidebar.png"
                alt="Psiconex"
                width={1951}
                height={393}
                className="hidden h-11 w-auto dark:block sm:h-12 xl:h-14"
                priority
              />
            </div>

            <div className="hidden lg:block">
              <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary/20 short:mt-5 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Hecho para psicólogos clínicos
              </span>
              <h1 className="mt-6 text-balance text-[length:clamp(2.5rem,4.2vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.035em] short:mt-4 short:text-[length:clamp(2.25rem,3.6vw,3rem)]">
                Escucha al paciente, <span className="gradient-primary-text">no a tu cuaderno</span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground short:mt-4 short:text-base">
                Psiconex transcribe tus sesiones, distingue quién habla, busca en el historial y redacta
                informes clínicos. Tú haces clínica; nosotros, la burocracia.
              </p>

              <ul className="mt-8 max-w-xl space-y-5 short:mt-6 short:space-y-4">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                  <li key={title} className="group flex items-start gap-4">
                    <span className="icon-tile h-11 w-11 shrink-0">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold leading-snug">{title}</p>
                      <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-8 flex max-w-xl items-start gap-2.5 border-t border-border/70 pt-6 text-[13px] leading-relaxed text-muted-foreground short:mt-6 short:pt-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Información clínica transmitida cifrada mediante HTTPS, conforme a la Ley 19.628.
              </p>
            </div>
          </section>

          {/* Columna del formulario */}
          <section
            className="w-full max-w-[460px] justify-self-center motion-safe:animate-fade-in-up lg:justify-self-end"
            style={{ animationDelay: "120ms" }}
          >
            <div className="relative rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_70px_-34px_hsl(var(--primary)/0.45)] backdrop-blur-sm dark:shadow-[0_30px_70px_-30px_rgb(0_0_0/0.75)] sm:p-9 short:sm:p-7">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
              />

              <div className="space-y-6 short:space-y-4">
                {registerStep !== "otp" && (
                  <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Gift className="h-3.5 w-3.5" />
                      14 días de prueba gratis con acceso completo
                    </span>
                    <h2 className="mt-5 text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl short:mt-4">
                      {activeTab === "login" ? "Ingresa a tu consulta" : "Crea tu cuenta"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground short:lg:hidden">
                      Plataforma de IA y gestión clínica para profesionales de la salud mental
                    </p>
                  </div>
                )}

                {/* Tabs */}
                {registerStep !== "otp" && (
                  <div className="grid grid-cols-2 rounded-xl bg-muted/70 p-1 text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => switchTab("login")}
                      className={`rounded-lg py-2 transition-all ${
                        activeTab === "login"
                          ? "bg-card text-foreground shadow-sm dark:bg-accent"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTab("register")}
                      className={`rounded-lg py-2 transition-all ${
                        activeTab === "register"
                          ? "bg-card text-foreground shadow-sm dark:bg-accent"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Crear cuenta
                    </button>
                  </div>
                )}

                {/* Acceso rápido con Google */}
                {registerStep !== "otp" && (
                  <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-3.5 text-xs short:p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Lightbulb className="h-3.5 w-3.5" />
                    </span>
                    <div className="space-y-1">
                      <p className="font-semibold text-primary">¿Tienes cuenta de Google?</p>
                      <p className="leading-relaxed text-muted-foreground short:leading-normal">
                        Haz clic en <strong className="font-semibold text-foreground">Iniciar sesión con Google</strong>{" "}
                        abajo. Se creará tu cuenta al instante sin formularios, contraseñas ni códigos.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Formulario de login */}
                {activeTab === "login" && (
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="loginIdentifier" className={labelClass}>
                        Usuario o Correo electrónico
                      </label>
                      <input
                        id="loginIdentifier"
                        type="text"
                        autoComplete="username"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className={inputClass}
                        placeholder="ejemplo@correo.com o admin"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="loginPassword" className={labelClass}>
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="loginPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className={`${inputClass} pr-11`}
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={eyeButtonClass}
                          tabIndex={-1}
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Link href="/recuperar-contrasena" className="text-sm font-medium text-primary hover:underline">
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <button type="submit" disabled={loading} className={submitClass}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Ingresando...
                        </>
                      ) : (
                        <>
                          Ingresar
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Formulario de registro */}
                {activeTab === "register" && registerStep === "form" && (
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label htmlFor="firstName" className={labelClass}>
                          Nombre
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={inputClass}
                          placeholder="María"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="lastName" className={labelClass}>
                          Apellido
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={inputClass}
                          placeholder="González"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="registerEmail" className={labelClass}>
                        Correo electrónico
                      </label>
                      <input
                        id="registerEmail"
                        type="email"
                        autoComplete="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className={inputClass}
                        placeholder="psicologa@ejemplo.com"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="registerPassword" className={labelClass}>
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="registerPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          className={`${inputClass} pr-11`}
                          placeholder="Mínimo 8 caracteres"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={eyeButtonClass}
                          tabIndex={-1}
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="confirmPassword" className={labelClass}>
                        Confirmar contraseña
                      </label>
                      <input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClass}
                        placeholder="Repite la contraseña"
                        required
                      />
                    </div>
                    <label className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                        required
                      />
                      <span>
                        Acepto los{" "}
                        <a
                          href="https://psiconex.cl/terminos"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Términos
                        </a>{" "}
                        y la{" "}
                        <a
                          href="https://psiconex.cl/privacidad"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Política de Privacidad
                        </a>
                      </span>
                    </label>
                    <button type="submit" disabled={loading || !acceptedTerms} className={submitClass}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando código...
                        </>
                      ) : (
                        <>
                          Continuar y verificar correo
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Verificación OTP */}
                {activeTab === "register" && registerStep === "otp" && (
                  <form onSubmit={handleOtpSubmit} className="space-y-5">
                    <div className="text-center">
                      <span className="icon-tile h-12 w-12">
                        <ShieldCheck className="h-6 w-6" />
                      </span>
                      <h3 className="mt-4 text-xl font-bold tracking-tight">Ingresa tu código de verificación</h3>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                        Enviamos un código de 6 dígitos a{" "}
                        <span className="font-semibold text-foreground">{registerEmail}</span>. Revisa tu bandeja
                        de entrada o spam.
                      </p>
                    </div>

                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="h-14 w-full rounded-xl border border-input bg-card pl-[0.4em] text-center font-mono text-2xl font-bold tracking-[0.4em] text-primary shadow-sm transition placeholder:text-muted-foreground/40 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 dark:bg-background/50"
                      placeholder="000000"
                      aria-label="Código de verificación"
                      autoFocus
                      required
                    />

                    <button
                      type="submit"
                      disabled={loading || otpCode.trim().length !== 6}
                      className={submitClass}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        <>
                          Confirmar y activar cuenta
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterStep("form");
                          setOtpCode("");
                          setError("");
                          setSuccessMessage("");
                        }}
                        className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Corregir correo
                      </button>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resendCooldown > 0 || loading}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                      >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar código"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Google */}
                {clientId && registerStep !== "otp" && (
                  <div className="space-y-4 short:space-y-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      O continuar con
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Error en el acceso con Google")}
                        theme={theme === "dark" ? "filled_black" : "outline"}
                        size="large"
                        width="100%"
                        text={activeTab === "register" ? "signup_with" : "signin_with"}
                      />
                    </div>
                    <p className="text-center text-xs leading-relaxed text-muted-foreground">
                      Al continuar con Google aceptas los{" "}
                      <a
                        href="https://psiconex.cl/terminos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Términos
                      </a>{" "}
                      y la{" "}
                      <a
                        href="https://psiconex.cl/privacidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Política de Privacidad
                      </a>
                      .
                    </p>
                  </div>
                )}

                {/* Pie de tarjeta con alternador rápido */}
                {registerStep !== "otp" && (
                  <div className="text-center text-sm text-muted-foreground">
                    {activeTab === "login" ? (
                      <p>
                        ¿No tienes una cuenta aún?{" "}
                        <button
                          type="button"
                          onClick={() => switchTab("register")}
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Crear cuenta gratis
                        </button>
                      </p>
                    ) : (
                      <p>
                        ¿Ya tienes una cuenta?{" "}
                        <button
                          type="button"
                          onClick={() => switchTab("login")}
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Inicia sesión aquí
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground lg:hidden">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Conexión cifrada (HTTPS) · Ley 19.628
            </p>
          </section>
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}
