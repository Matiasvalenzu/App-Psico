"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, listUsers } from "@/lib/api";
import { ShieldCheck, UserCog } from "lucide-react";

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
