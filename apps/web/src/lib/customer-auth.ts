"use client";

const CUST_TOKEN_KEY = "customer_token";
const CUST_REFRESH_KEY = "customer_refresh";
const CUST_PHONE_KEY = "customer_phone";
const CUST_AUTH_HINT_KEY = "customer_cookie_auth";
const COOKIE_AUTH_SENTINEL = "__cookie_auth__";
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export function hasCustomerSession(): boolean {
  if (typeof window === "undefined") return false;
  const legacyToken = localStorage.getItem(CUST_TOKEN_KEY) ?? sessionStorage.getItem(CUST_TOKEN_KEY);
  if (legacyToken && legacyToken !== COOKIE_AUTH_SENTINEL) {
    localStorage.removeItem(CUST_TOKEN_KEY);
    sessionStorage.removeItem(CUST_TOKEN_KEY);
    localStorage.setItem(CUST_AUTH_HINT_KEY, "1");
    return true;
  }
  return localStorage.getItem(CUST_AUTH_HINT_KEY) === "1" || Boolean(getCustomerPhone());
}

/**
 * Browser compatibility helper for existing API helpers.
 * Browser pages should treat this as a cookie-session sentinel, not a real token.
 */
export function getCustomerToken(): string | null {
  return hasCustomerSession() ? COOKIE_AUTH_SENTINEL : null;
}
export function setCustomerToken(_t?: string | null) {
  localStorage.removeItem(CUST_TOKEN_KEY);
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(CUST_TOKEN_KEY);
  localStorage.setItem(CUST_AUTH_HINT_KEY, "1");
}

export function getCustomerRefresh(): string | null {
  return null;
}
export function setCustomerRefresh(_t?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUST_REFRESH_KEY);
}

export function getCustomerPhone(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUST_PHONE_KEY) ?? sessionStorage.getItem(CUST_PHONE_KEY);
}
export function setCustomerPhone(p: string) { localStorage.setItem(CUST_PHONE_KEY, p); }

export function clearCustomerAuth() {
  fetch(`${API_BASE}/api/auth/customer/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
  localStorage.removeItem(CUST_TOKEN_KEY);
  localStorage.removeItem(CUST_REFRESH_KEY);
  localStorage.removeItem(CUST_PHONE_KEY);
  localStorage.removeItem(CUST_AUTH_HINT_KEY);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CUST_TOKEN_KEY);
    sessionStorage.removeItem(CUST_PHONE_KEY);
  }
}

export function isCustomerLoggedIn(): boolean {
  return hasCustomerSession();
}
