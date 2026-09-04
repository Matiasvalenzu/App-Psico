"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  login,
  loginWithGoogle,
  registerUser,
  verifyRegistrationCode,
  resendRegistrationCode,
} from "@/lib/api";
import {
  Eye,
  EyeOff,
  Mail,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const router = useRouter();

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
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        {/* Luces de fondo dinámicas */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-[300px] w-[500px] rounded-full bg-info/5 blur-3xl" />
          <div className="absolute right-1/4 top-1/3 h-[250px] w-[400px] rounded-full bg-primary/4 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          {/* Logo & Tagline */}
          <div className="space-y-3 text-center">
            <div className="mx-auto flex w-full max-w-[280px] items-center justify-center px-2 py-1">
              <Image
                src="/logo-psiconex.png"
                alt="Psiconex"
                width={1951}
                height={393}
                className="h-auto w-full object-contain drop-shadow-md"
                priority
              />
            </div>

            {/* Badge 14 días gratis */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              14 días de prueba gratis con acceso completo
            </div>

            <p className="text-xs text-muted-foreground sm:text-sm">
              Plataforma de IA y gestión clínica para profesionales de la salud mental
            </p>
          </div>

          {/* Selector de pestañas (Login vs Registro) - visible cuando no está en paso OTP */}
          {registerStep !== "otp" && (
            <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => switchTab("login")}
                className={`rounded-lg py-2 transition-all ${
                  activeTab === "login"
                    ? "bg-card text-foreground shadow-sm"
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
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Crear cuenta
              </button>
            </div>
          )}

          {/* Banner educativo para Google (Visible en formulario normal de login y registro) */}
          {registerStep !== "otp" && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs text-foreground/90">
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none">💡</span>
                <div className="space-y-1">
                  <p className="font-semibold text-primary">¿Tienes cuenta de Google?</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Haz clic en <strong>Iniciar sesión con Google</strong> abajo. Se creará tu
                    cuenta al instante sin formularios, contraseñas ni códigos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mensajes de Alerta / Éxito */}
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive sm:text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: INICIAR SESIÓN */}
          {activeTab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="loginIdentifier"
                  className="text-sm font-medium leading-none"
                >
                  Usuario o Correo electrónico
                </label>
                <input
                  id="loginIdentifier"
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  placeholder="ejemplo@correo.com o admin"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="loginPassword"
                  className="text-sm font-medium leading-none"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="loginPassword"
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          )}

          {/* TAB 2: CREAR CUENTA - PASO 1 (DATOS) */}
          {activeTab === "register" && registerStep === "form" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-xs font-medium leading-none"
                  >
                    Nombre
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    placeholder="María"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-xs font-medium leading-none"
                  >
                    Apellido
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    placeholder="González"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="registerEmail"
                  className="text-xs font-medium leading-none"
                >
                  Correo electrónico
                </label>
                <input
                  id="registerEmail"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  placeholder="psicologa@ejemplo.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="registerPassword"
                  className="text-xs font-medium leading-none"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="registerPassword"
                    type={showPassword ? "text" : "password"}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-medium leading-none"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  placeholder="Repite la contraseña"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Enviando código..." : "Continuar y verificar correo"}
              </button>
            </form>
          )}

          {/* TAB 2: CREAR CUENTA - PASO 2 (OTP VERIFICACIÓN) */}
          {activeTab === "register" && registerStep === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Ingresa tu código de verificación
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enviamos un código de 6 dígitos a{" "}
                  <span className="font-semibold text-foreground">{registerEmail}</span>. Revisa tu
                  bandeja de entrada o spam.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-input bg-background py-3 text-center font-mono text-2xl tracking-[0.4em] font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.trim().length !== 6}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Validando..." : "Confirmar y activar cuenta"}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterStep("form");
                    setOtpCode("");
                    setError("");
                    setSuccessMessage("");
                  }}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
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
                  {resendCooldown > 0
                    ? `Reenviar en ${resendCooldown}s`
                    : "Reenviar código"}
                </button>
              </div>
            </form>
          )}

          {/* Divisor y Botón de Google (Siempre disponible cuando no está en pantalla OTP) */}
          {clientId && registerStep !== "otp" && (
            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">O continuar con</span>
                </div>
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Error en el acceso con Google")}
                  theme="outline"
                  size="large"
                  width="100%"
                  text={activeTab === "register" ? "signup_with" : "signin_with"}
                />
              </div>
            </div>
          )}

          {/* Pie de tarjeta con alternador rápido */}
          {registerStep !== "otp" && (
            <div className="text-center text-xs text-muted-foreground">
              {activeTab === "login" ? (
                <p>
                  ¿No tienes una cuenta aún?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("register")}
                    className="font-semibold text-primary hover:underline"
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
                    className="font-semibold text-primary hover:underline"
                  >
                    Inicia sesión aquí
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
