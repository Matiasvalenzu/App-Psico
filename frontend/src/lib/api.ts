const localApiUrl =
  typeof window === "undefined"
    ? "http://localhost:8000/api"
    : `${window.location.protocol}//${window.location.hostname}:8000/api`;

export const API_URL = process.env.NEXT_PUBLIC_API_URL || localApiUrl;

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }
}

export function loadTokens() {
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

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    setTokens(data.access, refreshToken);
    return data.access;
  } catch {
    clearTokens();
    return null;
  }
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

  if (res.status === 401 && refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (res.status === 401) {
    clearTokens();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
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

export async function loginWithGoogle(credential: string) {
  const res = await fetch(`${API_URL}/auth/google/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
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

export async function verifyRegistrationCode(email: string, code: string) {
  const res = await publicApiFetch("/auth/register/verify/", {
    method: "POST",
    body: JSON.stringify({ email, code }),
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

export async function createUser(input: {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
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
