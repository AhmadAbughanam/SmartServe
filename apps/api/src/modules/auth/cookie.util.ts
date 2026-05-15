import type { Response } from "express";
import { env } from "../../config/env.js";

const ACCESS_COOKIE = "sro_access";
const REFRESH_COOKIE = "sro_refresh";

const baseOptions = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: "/api",
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
});

/** Set access token cookie (8h for staff, 1h for customer). */
export function setAccessCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie(ACCESS_COOKIE, token, {
    ...baseOptions(),
    maxAge: maxAgeMs,
  });
}

/** Set refresh token cookie (30d). */
export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions(),
    path: "/api/auth/customer", // Only sent to refresh/logout endpoints
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

/** Clear auth cookies. */
export function clearAuthCookies(res: Response) {
  const opts = baseOptions();
  res.clearCookie(ACCESS_COOKIE, { ...opts, path: "/api" });
  res.clearCookie(REFRESH_COOKIE, { ...opts, path: "/api/auth/customer" });
}

/** Extract access token from cookie. */
export function getAccessTokenFromCookie(cookies: Record<string, string>): string | undefined {
  return cookies?.[ACCESS_COOKIE];
}

/** Extract refresh token from cookie. */
export function getRefreshTokenFromCookie(cookies: Record<string, string>): string | undefined {
  return cookies?.[REFRESH_COOKIE];
}
