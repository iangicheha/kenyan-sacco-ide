import { apiUrl } from "./api";

const TOKEN_KEY = "meridian.jwt";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function ensureDevAuth(): Promise<string> {
  const existing = getAuthToken();
  if (existing) return existing;
  const response = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "analyst@meridian.local",
      institutionType: "sacco",
    }),
  });
  if (!response.ok) throw new Error("Unable to bootstrap auth token.");
  const data = await response.json();
  const token = String(data?.token ?? "");
  if (!token) throw new Error("Login response missing token.");
  setAuthToken(token);
  return token;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let token = await ensureDevAuth();
  let headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);

  let response = await fetch(apiUrl(input), { ...init, headers });
  if (response.status !== 401) return response;

  clearAuthToken();
  token = await ensureDevAuth();
  headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  response = await fetch(apiUrl(input), { ...init, headers });
  return response;
}
