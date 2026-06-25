const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const CSRF_COOKIE = "sro_csrf";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(extractApiMessage(status, body));
  }
}

function extractApiMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.filter(Boolean).join(" ");
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof body === "string" && body.trim()) return body;
  return `API error ${status}`;
}

function parseResponseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isUnsafeMethod(method?: string): boolean {
  const normalized = (method ?? "GET").toUpperCase();
  return normalized !== "GET" && normalized !== "HEAD" && normalized !== "OPTIONS";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(forceRefresh = false): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing && !forceRefresh) return existing;

  csrfTokenPromise ??= fetch(`${BASE}/api/auth/csrf`, {
    method: "GET",
    credentials: "include",
  })
    .then(async (res) => {
      const text = await res.text();
      const data = parseResponseBody(text);
      if (!res.ok) throw new ApiError(res.status, data);
      const token = typeof data === "object" && data && "csrfToken" in data
        ? (data as { csrfToken?: unknown }).csrfToken
        : undefined;
      if (typeof token !== "string" || !token) {
        throw new Error("Missing CSRF token");
      }
      return token;
    })
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Please sign in again.";
    if (error.status === 403) return "You do not have permission to access this information.";
    if (error.status === 404) return "The requested record was not found or is no longer available.";
    if (error.status >= 500) return "The server is temporarily unavailable. Please try again.";
    return error.message || fallback;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return apiWithRetry<T>(path, init, true);
}

async function apiWithRetry<T = unknown>(
  path: string,
  init: RequestInit | undefined,
  retryOnCsrfFailure: boolean,
): Promise<T> {
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...headersToRecord(init?.headers),
  };

  if (isUnsafeMethod(method)) {
    headers["X-CSRF-Token"] = await getCsrfToken();
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // Send cookies for httpOnly auth
  });
  const text = await res.text();
  const data = parseResponseBody(text);
  if (!res.ok) {
    if (res.status === 403 && retryOnCsrfFailure && isUnsafeMethod(method)) {
      csrfTokenPromise = null;
      await getCsrfToken(true);
      return apiWithRetry<T>(path, init, false);
    }
    throw new ApiError(res.status, data);
  }
  return data as T;
}

export const get = <T = unknown>(path: string) => api<T>(path);

export const post = <T = unknown>(
  path: string,
  body?: unknown,
  init?: RequestInit,
) =>
  api<T>(path, {
    ...init,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

export const patch = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });

/* ── Staff-authenticated requests ───────────────────── */
/* Bearer header is still used for explicit token auth.
   Cookies are sent automatically via credentials: "include". */

const COOKIE_AUTH_SENTINEL = "__cookie_auth__";

function authHeaders(token?: string | null): Record<string, string> {
  if (!token || token === COOKIE_AUTH_SENTINEL) return {};
  return { Authorization: `Bearer ${token}` };
}

export const authGet = <T = unknown>(path: string, token?: string | null) =>
  api<T>(path, { headers: authHeaders(token) });

export const authPost = <T = unknown>(path: string, token?: string | null, body?: unknown) =>
  api<T>(path, { method: "POST", headers: authHeaders(token), body: body ? JSON.stringify(body) : undefined });

export const authPatch = <T = unknown>(path: string, token?: string | null, body?: unknown) =>
  api<T>(path, { method: "PATCH", headers: authHeaders(token), body: body ? JSON.stringify(body) : undefined });

export const authDelete = <T = unknown>(path: string, token?: string | null) =>
  api<T>(path, { method: "DELETE", headers: authHeaders(token) });

export const customerGet = authGet;
export const customerPost = authPost;

/** Upload a file via multipart/form-data (do NOT set Content-Type — browser adds boundary). */
export async function authUpload<T = unknown>(path: string, token: string | null, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(token),
    "X-CSRF-Token": await getCsrfToken(),
  };
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });
  const text = await res.text();
  const data = parseResponseBody(text);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
