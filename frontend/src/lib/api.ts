import { toast } from "sonner";

const localApiUrl =
  typeof window === "undefined"
    ? "http://localhost:8000/api"
    : `${window.location.protocol}//${window.location.hostname}:8000/api`;

export const API_URL = process.env.NEXT_PUBLIC_API_URL || localApiUrl;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshBlocked = false;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }
}

export function loadTokens() {
  refreshBlocked = false;
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("access_token");
    refreshToken = localStorage.getItem("refresh_token");
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
}

export function getAccessToken() {
  if (!accessToken && typeof window !== "undefined") {
    loadTokens();
  }
  return accessToken;
}

let refreshInFlight: Promise<string | null> | null = null;
let authExpiredHandler: (() => void) | null = null;

export const RELOGIN_MESSAGE = "psiconex-relogin";
const REFRESH_EVERY_MS = 10 * 60 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler;
}

function readRefreshToken() {
  if (!refreshToken && typeof window !== "undefined") loadTokens();
  return refreshToken;
}

export function accessTokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function msUntilProactiveRefresh(expMs: number | null, now = Date.now()): number {
  if (expMs == null) return REFRESH_EVERY_MS;
  const until = expMs - REFRESH_MARGIN_MS - now;
  if (until <= 0) return 0;
  return Math.min(until, REFRESH_EVERY_MS);
}

async function refreshAccessToken(force = false): Promise<string | null> {
  if (force) refreshBlocked = false;
  if (refreshBlocked) return null;
  if (refreshInFlight) return refreshInFlight;
  const current = readRefreshToken();
  if (!current) return null;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: current }),
      });
      if (!res.ok) {
        refreshBlocked = true;
        return null;
      }
      const data = await res.json();
      if (!data?.access) {
        refreshBlocked = true;
        return null;
      }
      const nextRefresh = typeof data.refresh === "string" && data.refresh ? data.refresh : current;
      setTokens(data.access, nextRefresh);
      refreshBlocked = false;
      return data.access as string;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function refreshSession(force = false) {
  return refreshAccessToken(force);
}

export function startAccessKeepAlive(onExpired: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    const wait = msUntilProactiveRefresh(accessTokenExpiryMs(getAccessToken()));
    timer = setTimeout(run, wait);
  };

  const run = async () => {
    if (stopped) return;
    const token = await refreshAccessToken(true);
    if (!token) {
      onExpired();
      if (!stopped) timer = setTimeout(run, REFRESH_EVERY_MS);
      return;
    }
    schedule();
  };

  const onVisible = () => {
    if (document.visibilityState !== "visible" || stopped) return;
    if (msUntilProactiveRefresh(accessTokenExpiryMs(getAccessToken())) !== 0) return;
    if (timer) clearTimeout(timer);
    void run();
  };

  schedule();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  };
}

export function esVentanaRelogin() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("relogin") === "1";
}

export function cerrarVentanaRelogin() {
  if (!esVentanaRelogin() || !window.opener || window.opener.closed) return false;
  window.opener.postMessage({ type: RELOGIN_MESSAGE }, window.location.origin);
  window.close();
  return true;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_URL}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && readRefreshToken() && !refreshBlocked) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (res.status === 401) {
    if (authExpiredHandler) {
      authExpiredHandler();
    } else {
      clearTokens();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
  }

  if (res.status === 403 && typeof window !== "undefined") {
    const data = await res.clone().json().catch(() => null);
    if (data?.code === "subscription_inactive") {
      toast.error("Tu cuenta está en solo lectura", {
        id: "subscription_inactive",
        description: "Reactiva tu plan para hacer cambios. Puedes ver y exportar tus datos.",
      });
    } else if (data?.code === "plan_required") {
      toast.error("Esta función es parte del Plan Plus", {
        id: "plan_required",
        action: { label: "Ver planes", onClick: () => window.location.assign("/dashboard/suscripcion") },
      });
    }
  }

  return res;
}

export async function publicApiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export async function login(username: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }
  if (res.status === 401) throw new Error("Credenciales inválidas");
  if (!res.ok) throw new Error("No se pudo iniciar sesión. Intenta nuevamente.");
  const data = await res.json();
  setTokens(data.access, data.refresh);
  return data;
}

export async function loginWithGoogle(credential: string, atribucion: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}/auth/google/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, ...atribucion }),
  });
  if (!res.ok) {
    let message = "Error de autenticación con Google";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {}
    throw new Error(message);
  }
  const data = await res.json();
  setTokens(data.access, data.refresh);
  return data;
}

export async function registerUser(payload: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  const res = await publicApiFetch("/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = "Error al solicitar el registro.";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export async function verifyRegistrationCode(
  email: string,
  code: string,
  atribucion: Record<string, string> = {},
) {
  const res = await publicApiFetch("/auth/register/verify/", {
    method: "POST",
    body: JSON.stringify({ email, code, ...atribucion }),
  });
  if (!res.ok) {
    let message = "Error al verificar el código.";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {}
    throw new Error(message);
  }
  const data = await res.json();
  setTokens(data.access, data.refresh);
  return data;
}

export async function resendRegistrationCode(email: string) {
  const res = await publicApiFetch("/auth/register/resend/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    let message = "Error al reenviar el código.";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export async function getCurrentUser() {
  const res = await apiFetch("/auth/me/");
  if (!res.ok) throw new Error("No se pudo obtener el usuario actual");
  return res.json();
}

export async function listUsers() {
  const res = await apiFetch("/auth/users/list/");
  if (!res.ok) throw new Error("No se pudieron cargar los usuarios");
  return res.json();
}

export async function getAdminSystemStats() {
  const res = await apiFetch("/auth/users/stats/");
  if (!res.ok) throw new Error("No se pudieron cargar las estadísticas del sistema");
  return res.json();
}

export async function updateUserSubscription(
  userId: number,
  data: { dias_adicionales_prueba?: number; estado?: string; plan?: string }
) {
  const res = await apiFetch(`/auth/users/${userId}/subscription/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = "No se pudo actualizar la suscripción.";
    try {
      const errData = await res.json();
      message = errData.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export async function deleteUser(userId: number) {
  const res = await apiFetch(`/auth/users/${userId}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let message = "No se pudo eliminar el usuario.";
    try {
      const errData = await res.json();
      message = errData.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export async function createUser(input: {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  plan?: string;
  dias_prueba?: number;
  is_admin?: boolean;
  is_superuser?: boolean;
}) {
  const res = await apiFetch("/auth/users/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let message = "No se pudo crear el usuario.";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {
      // Keep generic message when backend does not return JSON.
    }
    throw new Error(message);
  }
  return res.json();
}

export async function logout() {
  clearTokens();
}

