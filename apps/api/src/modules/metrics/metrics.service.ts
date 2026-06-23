import { Injectable } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal = new Counter({
    name: "sro_http_requests_total",
    help: "Total HTTP requests handled by the API",
    labelNames: ["method", "route", "status_class"] as const,
    registers: [this.registry],
  });
  private readonly httpRequestDurationSeconds = new Histogram({
    name: "sro_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_class"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [this.registry],
  });
  private readonly smsAttemptsTotal = new Counter({
    name: "sro_sms_attempts_total",
    help: "SMS delivery attempts by provider and outcome",
    labelNames: ["provider", "purpose", "outcome"] as const,
    registers: [this.registry],
  });
  private readonly otpRequestsTotal = new Counter({
    name: "sro_customer_otp_requests_total",
    help: "Customer OTP request outcomes",
    labelNames: ["outcome"] as const,
    registers: [this.registry],
  });
  private readonly otpVerificationsTotal = new Counter({
    name: "sro_customer_otp_verifications_total",
    help: "Customer OTP verification outcomes",
    labelNames: ["outcome"] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: "sro_nodejs_",
    });
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    this.httpRequestsTotal.labels(method, route, statusClass).inc();
    this.httpRequestDurationSeconds.labels(method, route, statusClass).observe(durationMs / 1000);
  }

  recordSmsAttempt(provider: string, purpose: string, outcome: "sent" | "failed" | "noop"): void {
    this.smsAttemptsTotal.labels(provider, purpose, outcome).inc();
  }

  recordOtpRequest(outcome: "issued" | "failed"): void {
    this.otpRequestsTotal.labels(outcome).inc();
  }

  recordOtpVerification(outcome: "succeeded" | "failed" | "blocked"): void {
    this.otpVerificationsTotal.labels(outcome).inc();
  }
}
