export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100";

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
