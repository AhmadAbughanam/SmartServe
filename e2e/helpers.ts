/**
 * E2E test helpers.
 *
 * Prerequisites:
 * - API running at http://localhost:4000
 * - Web running at http://localhost:3000
 * - Database seeded with npm run seed
 */

const API = "http://localhost:4000/api";

// ── API helpers ─────────────────────────────────────

export async function apiPost(path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function apiGet(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  return res.json();
}

// ── Cached login (avoids rate limit) ────────────────

import fs from "node:fs";
import path from "node:path";

const CACHE_FILE = path.join(process.cwd(), ".e2e-auth-cache.json");
type AuthEntry = { token: string; branchId: string; name: string; role: string; cachedAt: number };

function loadCache(): Record<string, AuthEntry> {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, AuthEntry>;
    // Tokens are valid for 8h — cache for 1h to be safe
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const valid: Record<string, AuthEntry> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v.cachedAt > oneHourAgo) valid[k] = v;
    }
    return valid;
  } catch { return {}; }
}

function saveCache(cache: Record<string, AuthEntry>) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}
}

const tokenCache = loadCache();

/**
 * Login via API and cache to disk.
 * Cache persists across Playwright runs to avoid rate limiting.
 */
export async function getStaffAuth(email: string, password: string = "password123") {
  if (tokenCache[email]) return tokenCache[email];

  const res = await apiPost("/auth/staff/login", { email, password });
  if (!res.accessToken || !res.staff) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res)}`);
  }
  const entry: AuthEntry = {
    token: res.accessToken,
    branchId: res.staff.branchId,
    name: res.staff.name,
    role: res.staff.primaryRole,
    cachedAt: Date.now(),
  };
  tokenCache[email] = entry;
  saveCache(tokenCache);
  return entry;
}

/**
 * Inject staff auth into a Playwright page's localStorage.
 * After calling this, navigating to any admin/kitchen/waiter page
 * will pick up the token without needing a browser-based login.
 */
export async function injectStaffAuth(
  page: import("@playwright/test").Page,
  email: string,
) {
  const auth = await getStaffAuth(email);

  // Must navigate to the origin first so localStorage is accessible
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.evaluate(
    ({ token, branchId, name, role }) => {
      localStorage.setItem("staff_token", token);
      localStorage.setItem("staff_branch_id", branchId);
      localStorage.setItem("staff_name", name);
      localStorage.setItem("staff_role", role);
    },
    auth,
  );
}

export async function apiPatch(path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: "PATCH", headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

/** Create a session + order via API. Returns { sessionId, orderId }. */
export async function createTestOrder(tableCode: string = "T5") {
  await resetTablesAndSessions();
  const session = await apiPost("/sessions/start", { branchId: "seed-branch-1", tableCode, guestCount: 1 });
  const order = await apiPost(`/sessions/${session.id}/orders`, {
    items: [{ menuItemId: "seed-item-cola", quantity: 1 }],
    idempotencyKey: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });
  return { sessionId: session.id, orderId: order.id, branchId: "seed-branch-1" };
}

// ── Table/session reset ─────────────────────────────

export async function resetTablesAndSessions() {
  const auth = await getStaffAuth("owner@demo.com");

  const tables = await apiGet(`/branches/${auth.branchId}/tables`, auth.token);

  for (const table of tables) {
    // End any active session on the table
    if (table.lastSession?.status === "ACTIVE" && table.lastSession?.id) {
      try {
        await fetch(`${API}/sessions/${table.lastSession.id}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        });
      } catch {}
    }

    // Reset CLEANING or OCCUPIED tables to AVAILABLE
    if (table.status === "CLEANING" || table.status === "OCCUPIED") {
      try {
        // OCCUPIED → can't go directly to AVAILABLE (needs CLEANING first via session end)
        // CLEANING → AVAILABLE
        if (table.status === "CLEANING") {
          await fetch(`${API}/tables/${table.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
            body: JSON.stringify({ status: "AVAILABLE" }),
          });
        }
      } catch {}
    }
  }

  // Second pass: after sessions ended, clean up any newly-CLEANING tables
  const tables2 = await apiGet(`/branches/${auth.branchId}/tables`, auth.token);
  for (const table of tables2) {
    if (table.status === "CLEANING") {
      try {
        await fetch(`${API}/tables/${table.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
          body: JSON.stringify({ status: "AVAILABLE" }),
        });
      } catch {}
    }
  }
}
