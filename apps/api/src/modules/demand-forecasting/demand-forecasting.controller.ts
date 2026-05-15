import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { DemandForecastResponse } from "@smart-restaurant/shared-types";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { DemandForecastService } from "./demand-forecast.service.js";
import { DemandForecastQueryDto } from "./dto/demand-forecast-query.dto.js";

@Controller()
export class DemandForecastingController {
  constructor(
    @Inject(DemandForecastService)
    private readonly demandForecastService: DemandForecastService,
  ) {}

  @Get("admin/ai/demand-forecast")
  @RequirePermissions("analytics:read")
  getDemandForecast(
    @Query() query: DemandForecastQueryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ): Promise<DemandForecastResponse> {
    return this.demandForecastService.getDemandForecast(query, staff);
  }
}
