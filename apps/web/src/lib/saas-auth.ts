"use client";

const SAAS_HINT_KEY = "saas_owner_cookie_auth";
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export function setSaasOwnerSession() {
  localStorage.setItem(SAAS_HINT_KEY, "1");
}

export function hasSaasOwnerSessionHint() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SAAS_HINT_KEY) === "1";
}

export function clearSaasOwnerSession() {
  fetch(`${API_BASE}/api/auth/saas/logout`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
  localStorage.removeItem(SAAS_HINT_KEY);
}
