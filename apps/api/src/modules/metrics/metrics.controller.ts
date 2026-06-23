import { Controller, Get, Header, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/decorators/public.decorator.js";
import { MetricsService } from "./metrics.service.js";

@Public()
@Controller("metrics")
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader("Content-Type", this.metricsService.getContentType());
    res.send(await this.metricsService.getMetrics());
  }
}
