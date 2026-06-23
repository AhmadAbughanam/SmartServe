import { Inject, Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { MetricsService } from "../modules/metrics/metrics.service.js";

/**
 * HTTP request logger middleware.
 *
 * Logs: request ID, method, path, status code, and response time.
 * Does NOT log: request bodies, authorization headers, cookies, or query strings
 * that might contain tokens, OTPs, passwords, or other secrets.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, baseUrl, path } = req;
    const route = `${baseUrl}${path}`;
    const requestId = this.resolveRequestId(req);

    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-ID", requestId);

    res.on("finish", () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const metricsRoute = this.resolveMetricsRoute(req, route);
      const level =
        statusCode >= 500
          ? "error"
          : statusCode === 401 || statusCode === 403
            ? "debug"
            : statusCode >= 400
              ? "warn"
              : "log";

      if (metricsRoute !== "/api/metrics") {
        this.metricsService.recordHttpRequest(method, metricsRoute, statusCode, ms);
      }
      this.logger[level](`requestId=${requestId} ${method} ${route} ${statusCode} ${ms}ms`);
    });

    next();
  }

  private resolveRequestId(req: Request): string {
    const header = req.headers["x-request-id"];
    const candidate = Array.isArray(header) ? header[0] : header;
    if (candidate && /^[a-zA-Z0-9._:-]{8,128}$/.test(candidate)) {
      return candidate;
    }
    return randomUUID();
  }

  private resolveMetricsRoute(req: Request, fallbackRoute: string): string {
    const routePath = req.route?.path;
    if (typeof routePath === "string") {
      const baseUrl = req.baseUrl ?? "";
      return `${baseUrl}${routePath}`;
    }
    return fallbackRoute;
  }
}
