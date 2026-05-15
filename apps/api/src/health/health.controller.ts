import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { Public } from "../modules/auth/decorators/public.decorator.js";
import { env } from "../config/env.js";

type DepStatus = "ok" | "degraded" | "unavailable";

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    const deps: Record<string, DepStatus> = {};

    // Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      deps.database = "ok";
    } catch {
      deps.database = "unavailable";
    }

    // Redis — simple TCP check on the configured port
    deps.redis = await this.checkTcp(env.redisUrl);

    // AI service — HTTP health check
    deps.ai = await this.checkHttp(`${env.aiServiceUrl}/health`);

    const values = Object.values(deps);
    const overall: DepStatus = values.every((v) => v === "ok")
      ? "ok"
      : values.some((v) => v === "unavailable")
        ? "degraded"
        : "ok";

    return {
      service: "api",
      status: overall,
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      version: env.buildVersion,
      commit: env.commitSha,
      dependencies: deps,
    };
  }

  private async checkTcp(url: string): Promise<DepStatus> {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const port = parseInt(parsed.port || "6379", 10);

      return new Promise((resolve) => {
        // Dynamic import to avoid bundling issues
        import("node:net").then(({ createConnection }) => {
          const socket = createConnection({ host, port, timeout: 2000 });
          socket.on("connect", () => { socket.destroy(); resolve("ok"); });
          socket.on("error", () => { socket.destroy(); resolve("unavailable"); });
          socket.on("timeout", () => { socket.destroy(); resolve("unavailable"); });
        }).catch(() => resolve("unavailable"));
      });
    } catch {
      return "unavailable";
    }
  }

  private async checkHttp(url: string): Promise<DepStatus> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok ? "ok" : "degraded";
    } catch {
      return "unavailable";
    }
  }
}
