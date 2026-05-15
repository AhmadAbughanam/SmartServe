const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // Send cookies for httpOnly auth
  });
  const text = await res.text();
  const data = parseResponseBody(text);
  if (!res.ok) throw new ApiError(res.status, data);
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

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const authGet = <T = unknown>(path: string, token: string) =>
  api<T>(path, { headers: authHeaders(token) });

export const authPost = <T = unknown>(path: string, token: string, body?: unknown) =>
  api<T>(path, { method: "POST", headers: authHeaders(token), body: body ? JSON.stringify(body) : undefined });

export const authPatch = <T = unknown>(path: string, token: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", headers: authHeaders(token), body: body ? JSON.stringify(body) : undefined });

export const authDelete = <T = unknown>(path: string, token: string) =>
  api<T>(path, { method: "DELETE", headers: authHeaders(token) });

export const customerGet = authGet;
export const customerPost = authPost;

/** Upload a file via multipart/form-data (do NOT set Content-Type — browser adds boundary). */
export async function authUpload<T = unknown>(path: string, token: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: "include",
  });
  const text = await res.text();
  const data = parseResponseBody(text);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
