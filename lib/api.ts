export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function getCsrf(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/(?:^|; )csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1] as string) : undefined;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** True when the server rejected us for auth/session reasons (not app bugs). */
export function isAuthFailure(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 401) return true;
  return e.status === 403 && /csrf|session|authenticated|forbidden/i.test(e.message);
}

/** Send the user to login once (avoids redirect loops on public pages). */
export function redirectToLogin(reason: string) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/submit") || path === "/") return;
  window.location.href = `/login?reason=${reason}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCsrf();
  if (csrf && init?.method && init.method !== "GET") headers["x-csrf-token"] = csrf;
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new ApiError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? `API ${res.status}`);
    // Mutations fail auth/CSRF checks when the session died (new login fixes it).
    if (init?.method && init.method !== "GET" && isAuthFailure(err)) {
      redirectToLogin("session");
    }
    throw err;
  }
  return body as T;
}

export function inr(n: number | string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n));
}

export function inDate(d: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

/** Current month as YYYY-MM for period defaults/filters. */
export function currentPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Today as YYYY-MM-DD for date inputs. */
export function todayISO(now = new Date()): string {
  return `${currentPeriod(now)}-${String(now.getDate()).padStart(2, "0")}`;
}
