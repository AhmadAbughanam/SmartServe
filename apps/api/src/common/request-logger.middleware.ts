import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

/**
 * HTTP request logger middleware.
 *
 * Logs: method, path, status code, and response time.
 * Does NOT log: request bodies, authorization headers, cookies, or query strings
 * that might contain tokens, OTPs, passwords, or other secrets.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, baseUrl, path } = req;
    const route = `${baseUrl}${path}`;

    res.on("finish", () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const level =
        statusCode >= 500
          ? "error"
          : statusCode === 401 || statusCode === 403
            ? "debug"
            : statusCode >= 400
              ? "warn"
              : "log";

      this.logger[level](`${method} ${route} ${statusCode} ${ms}ms`);
    });

    next();
  }
}
