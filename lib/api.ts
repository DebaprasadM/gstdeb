export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function getCsrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/(?:^|; )csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1] as string) : undefined;
}

// In-memory token (seeded from the live session). Survives browsers that
// drop the readable csrf cookie while keeping the HttpOnly session cookie.
let memCsrf: string | null = null;

function getCsrf(): string | undefined {
  return memCsrf ?? getCsrfCookie();
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

function isCsrfFailure(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && /csrf/i.test(e.message);
}

async function rawFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sent = init as (RequestInit & { csrfToken?: string }) | undefined;
  const csrf = sent?.csrfToken ?? getCsrf();
  if (csrf && init?.method && init.method !== "GET") headers["x-csrf-token"] = csrf;
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? `API ${res.status}`);
  return body as T;
}

/** Attach a CSRF token to mutations: memory → cookie → live session. */
async function withCsrf(init?: RequestInit): Promise<RequestInit | undefined> {
  if (!init?.method || init.method === "GET" || typeof document === "undefined") return init;
  if (getCsrf()) return init;
  try {
    const r = await rawFetch<{ data: { csrfToken: string } }>("/api/v1/auth/csrf", { method: "POST" });
    if (r.data.csrfToken) {
      memCsrf = r.data.csrfToken;
      return { ...init, csrfToken: memCsrf } as RequestInit;
    }
  } catch { /* session dead → let the real call surface 401 → login */ }
  return init;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await rawFetch<T>(path, await withCsrf(init));
  } catch (e) {
    // CSRF token lost but session alive (new tab, cleared cookies)? Refresh
    // the token from the live session and retry once — no re-login needed.
    if (init?.method && init.method !== "GET" && isCsrfFailure(e)) {
      try {
        const r = await rawFetch<{ data: { csrfToken?: string } }>("/api/v1/auth/csrf", { method: "POST" });
        if (r.data.csrfToken) memCsrf = r.data.csrfToken;
        return await rawFetch<T>(path, memCsrf ? ({ ...init, csrfToken: memCsrf } as RequestInit) : init);
      } catch (retryErr) {
        if (isAuthFailure(retryErr)) redirectToLogin("session");
        throw retryErr;
      }
    }
    if (init?.method && init.method !== "GET" && isAuthFailure(e)) {
      redirectToLogin("session");
    }
    throw e;
  }
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
