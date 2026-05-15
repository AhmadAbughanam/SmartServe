"use client";

const CUST_TOKEN_KEY = "customer_token";
const CUST_REFRESH_KEY = "customer_refresh";
const CUST_PHONE_KEY = "customer_phone";

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUST_TOKEN_KEY) ?? sessionStorage.getItem(CUST_TOKEN_KEY);
}
export function setCustomerToken(t: string) { localStorage.setItem(CUST_TOKEN_KEY, t); }

export function getCustomerRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUST_REFRESH_KEY);
}
export function setCustomerRefresh(t: string) { localStorage.setItem(CUST_REFRESH_KEY, t); }

export function getCustomerPhone(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUST_PHONE_KEY) ?? sessionStorage.getItem(CUST_PHONE_KEY);
}
export function setCustomerPhone(p: string) { localStorage.setItem(CUST_PHONE_KEY, p); }

export function clearCustomerAuth() {
  localStorage.removeItem(CUST_TOKEN_KEY);
  localStorage.removeItem(CUST_REFRESH_KEY);
  localStorage.removeItem(CUST_PHONE_KEY);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CUST_TOKEN_KEY);
    sessionStorage.removeItem(CUST_PHONE_KEY);
  }
}

export function isCustomerLoggedIn(): boolean {
  return !!getCustomerToken();
}
