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

  // Log the attempt for debugging
  const loginUrl = apiUrl("/api/auth/login");
  console.log("[auth] Attempting dev login to:", loginUrl);

  try {
    const response = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "analyst@meridian.local",
        institutionType: "sacco",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error body");
      console.error("[auth] Login failed:", response.status, errorText);
      throw new Error(`Unable to bootstrap auth token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const token = String(data?.token ?? "");
    if (!token) throw new Error("Login response missing token.");
    setAuthToken(token);
    console.log("[auth] Dev login successful");
    return token;
  } catch (error) {
    console.error("[auth] Login error:", error);
    throw error;
  }
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

/**
 * Clear all auth data and service workers.
 * Run this in browser console if you get 401 errors:
 *   import('@/lib/authApi').then(m => m.clearAllAuthData())
 */
export async function clearAllAuthData(): Promise<void> {
  // Clear localStorage
  clearAuthToken();

  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
    console.log('[auth] Unregistered', registrations.length, 'service workers');
  }

  // Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[auth] Cleared', cacheNames.length, 'caches');
  }

  console.log('[auth] All auth data cleared. Reload the page.');
}
