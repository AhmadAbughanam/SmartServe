import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { CSRF_COOKIE, getAccessTokenFromCookie, getRefreshTokenFromCookie } from "../cookie.util.js";
import { verifyCsrfToken } from "../csrf.util.js";

type CsrfRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXEMPT_EXACT_PATHS = new Set([
  "/api/auth/csrf",
  "/api/auth/staff/login",
  "/api/auth/staff/logout",
  "/api/auth/customer/otp/request",
  "/api/auth/customer/otp/verify",
  "/api/auth/customer/refresh",
  "/api/auth/customer/logout",
]);

const EXEMPT_PREFIXES = ["/api/payments/webhook/"];

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CsrfRequest>();
    if (this.shouldSkip(request)) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE];
    const headerToken = this.headerValue(request.headers["x-csrf-token"]);
    if (!cookieToken || !headerToken || cookieToken !== headerToken || !verifyCsrfToken(headerToken)) {
      throw new ForbiddenException("Invalid CSRF token");
    }

    return true;
  }

  private shouldSkip(request: CsrfRequest): boolean {
    const method = request.method?.toUpperCase() ?? "GET";
    if (SAFE_METHODS.has(method)) return true;
    if (this.hasBearerToken(request)) return true;
    if (!this.hasAuthCookie(request)) return true;

    const path = this.normalizedPath(request);
    if (EXEMPT_EXACT_PATHS.has(path)) return true;
    return EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  private hasBearerToken(request: CsrfRequest): boolean {
    const authorization = this.headerValue(request.headers.authorization);
    if (!authorization) return false;
    const [scheme, token] = authorization.split(" ");
    return scheme === "Bearer" && Boolean(token);
  }

  private hasAuthCookie(request: CsrfRequest): boolean {
    const cookies = request.cookies ?? {};
    return Boolean(getAccessTokenFromCookie(cookies) || getRefreshTokenFromCookie(cookies));
  }

  private normalizedPath(request: CsrfRequest): string {
    const rawPath = request.path ?? request.originalUrl ?? request.url ?? "";
    const path = rawPath.split("?")[0] || "/";
    return path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
