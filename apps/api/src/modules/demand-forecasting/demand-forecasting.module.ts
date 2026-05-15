import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DemandForecastingController } from "./demand-forecasting.controller.js";
import { DemandForecastService } from "./demand-forecast.service.js";
import { ForecastAccuracyCron } from "./forecast-accuracy.cron.js";
import { DemandForecastLlmService } from "./demand-forecast-llm.service.js";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [DemandForecastingController],
  providers: [DemandForecastService, ForecastAccuracyCron, DemandForecastLlmService],
})
export class DemandForecastingModule {}