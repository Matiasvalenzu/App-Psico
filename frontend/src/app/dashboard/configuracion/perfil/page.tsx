"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Profile {
  login_email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email_notificaciones: string;
  email_notificaciones_efectivo: string;
  email_notificaciones_pendiente: string;
  email_notificaciones_verificado: boolean;
  rut_profesional: string;
  especialidad_clinica: string;
  registro_profesional: string;
  telefono_profesional: string;
  modalidad_atencion: "PRESENCIAL" | "ONLINE" | "HIBRIDA";
  comuna: string;
  direccion_consulta: string;
}

const EMPTY_PROFILE: Profile = {
  login_email: "",
  first_name: "",
  last_name: "",
  full_name: "",
  email_notificaciones: "",
  email_notificaciones_efectivo: "",
  email_notificaciones_pendiente: "",
  email_notificaciones_verificado: false,
  rut_profesional: "",
  especialidad_clinica: "",
  registro_profesional: "",
  telefono_profesional: "",
  modalidad_atencion: "HIBRIDA",
  comuna: "",
  direccion_consulta: "",
};

function getError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const first = Object.values(data as Record<string, unknown>)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === "string") return first;
  return fallback;
}

export default function ProfessionalProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const response = await apiFetch("/cuenta/perfil/");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getError(data, "No pudimos cargar tu perfil."));
      setProfile(data);
      setNotificationEmail(data.email_notificaciones_efectivo || data.login_email);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos cargar tu perfil.");
    } finally {
      setLoading(false);
    }
  }

  function update(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/cuenta/perfil/", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email_notificaciones: notificationEmail,
          rut_profesional: profile.rut_profesional,
          especialidad_clinica: profile.especialidad_clinica,
          registro_profesional: profile.registro_profesional,
          telefono_profesional: profile.telefono_profesional,
          modalidad_atencion: profile.modalidad_atencion,
          comuna: profile.comuna,
          direccion_consulta: profile.direccion_consulta,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getError(data, "No pudimos guardar los cambios."));
      setProfile(data);
      setMessage(data.codigo_enviado ? "Guardamos tu perfil y enviamos un código al correo nuevo." : "Perfil actualizado correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyEmail() {
    if (verificationCode.length !== 6) return;
    setVerifying(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/cuenta/perfil/verificar-email/", {
        method: "POST",
        body: JSON.stringify({ codigo: verificationCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getError(data, "El código no es válido."));
      setProfile(data);
      setNotificationEmail(data.email_notificaciones_efectivo);
      setVerificationCode("");
      setMessage("Correo de notificaciones verificado correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "El código no es válido.");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-bold tracking-tight">Mi perfil profesional</h1><p className="text-sm text-muted-foreground">Datos de tu práctica y canales de contacto de Psiconex.</p></div>
      </div>

      {(error || message) && <div className={`rounded-xl border p-4 text-sm ${error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>{error || message}</div>}

      {profile.email_notificaciones_pendiente && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="flex-1"><h2 className="font-semibold text-amber-900 dark:text-amber-200">Verifica tu correo nuevo</h2><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Enviamos un código a {profile.email_notificaciones_pendiente}. Hasta verificarlo seguiremos usando {profile.email_notificaciones_efectivo}.</p><div className="mt-4 flex max-w-md gap-2"><input inputMode="numeric" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center font-semibold tracking-[0.25em] dark:bg-background" /><button type="button" onClick={verifyEmail} disabled={verifying || verificationCode.length !== 6} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{verifying && <Loader2 className="h-4 w-4 animate-spin" />}Verificar</button></div></div></div>
        </section>
      )}

      <form onSubmit={saveProfile} className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /><h2 className="font-semibold">Identificación profesional</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombres" value={profile.first_name} onChange={(value) => update("first_name", value)} />
            <Field label="Apellidos" value={profile.last_name} onChange={(value) => update("last_name", value)} />
            <Field label="RUT profesional" value={profile.rut_profesional} onChange={(value) => update("rut_profesional", value)} placeholder="12.345.678-9" />
            <Field label="Registro profesional" value={profile.registro_profesional} onChange={(value) => update("registro_profesional", value)} />
            <Field label="Especialidad clínica" value={profile.especialidad_clinica} onChange={(value) => update("especialidad_clinica", value)} className="md:col-span-2" />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">Cuenta y notificaciones</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Correo de acceso" value={profile.login_email} disabled helper="Se administra con tu cuenta de acceso y no puede cambiarse aquí." />
            <Field label="Correo de notificaciones" type="email" value={notificationEmail} onChange={setNotificationEmail} helper="Los cambios requieren un código de verificación." />
          </div>
          {profile.email_notificaciones_verificado && <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Correo actual verificado</p>}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><h2 className="font-semibold">Atención y contacto</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Teléfono profesional" value={profile.telefono_profesional} onChange={(value) => update("telefono_profesional", value)} placeholder="+56 9 1234 5678" />
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Modalidad de atención</span><select value={profile.modalidad_atencion} onChange={(event) => update("modalidad_atencion", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="PRESENCIAL">Presencial</option><option value="ONLINE">Online</option><option value="HIBRIDA">Presencial y online</option></select></label>
            <Field label="Comuna" value={profile.comuna} onChange={(value) => update("comuna", value)} />
            <Field label="Dirección de consulta" value={profile.direccion_consulta} onChange={(value) => update("direccion_consulta", value)} />
          </div>
        </section>

        <div className="flex justify-end"><button type="submit" disabled={saving} className="flex min-w-40 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</button></div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, helper, disabled, className = "" }: { label: string; value: string; onChange?: (value: string) => void; type?: string; placeholder?: string; helper?: string; disabled?: boolean; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-medium">{label}</span><input type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} disabled={disabled} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground" />{helper && <span className="mt-1.5 block text-xs text-muted-foreground">{helper}</span>}</label>;
}
