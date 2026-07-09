"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, listUsers, apiFetch } from "@/lib/api";
import { ShieldCheck, UserCog, KeyRound, Loader2, X } from "lucide-react";

interface SystemUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
}

function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fullName(user: SystemUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Sin nombre";
}

export default function UsuariosPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Change password state
  const [changePasswordUser, setChangePasswordUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser.is_superuser !== true) {
          router.replace("/dashboard");
          return;
        }

        setChecking(false);
        const data = await listUsers();
        setUsers(data);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los usuarios.");
        setChecking(false);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!changePasswordUser || !newPassword) return;

    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      const res = await apiFetch(`/auth/users/${changePasswordUser.id}/password/`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        let message = "Error al cambiar la contraseña.";
        try {
          const data = await res.json();
          message = data.detail || message;
        } catch {}
        throw new Error(message);
      }

      setPasswordSuccess("Contraseña actualizada exitosamente.");
      setNewPassword("");
      setTimeout(() => {
        setChangePasswordUser(null);
        setPasswordSuccess("");
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Error al cambiar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  }

  if (checking) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Administración de cuentas con acceso al sistema.
          </p>
        </div>
        <a
          href="/dashboard/usuarios/crear"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition-colors hover:bg-primary/90"
        >
          Crear Usuario
        </a>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card shadow-card">
        <div className="border-b border-border/60 px-4 py-3 text-sm text-muted-foreground">
          {loading ? "Cargando usuarios..." : `${users.length} usuario${users.length !== 1 ? "s" : ""}`}
        </div>

        {!loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <UserCog className="h-10 w-10 opacity-60" />
            <p>No hay usuarios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Último acceso</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fullName(user)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.is_active
                            ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_superuser ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <ShieldCheck className="h-3 w-3" />
                          Superuser
                        </span>
                      ) : user.is_staff ? (
                        <span className="inline-flex rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                          Staff
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Usuario</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(user.last_login)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setChangePasswordUser(user);
                          setNewPassword("");
                          setPasswordError("");
                          setPasswordSuccess("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Cambiar clave
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Cambiar Clave ── */}
      {changePasswordUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm" onClick={() => setChangePasswordUser(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-elevated animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Cambiar contraseña</h2>
              <button type="button" onClick={() => setChangePasswordUser(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ingresa la nueva contraseña para <strong>{changePasswordUser.username}</strong>.
            </p>

            {passwordError && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                  autoFocus
                  minLength={8}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePasswordUser(null)}
                  disabled={changingPassword}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !newPassword}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Actualizar clave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
