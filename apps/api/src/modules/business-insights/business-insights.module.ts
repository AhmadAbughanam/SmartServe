import { Module } from '@nestjs/common';
import { BusinessInsightsController } from './business-insights.controller.js';
import { BusinessInsightsService } from './business-insights.service.js';
import { ScheduledSummaryCron } from './scheduled-summary.cron.js';

@Module({
  // Note: Ensure your PrismaModule is imported globally or added to imports here
  controllers: [BusinessInsightsController],
  providers: [BusinessInsightsService, ScheduledSummaryCron],
  exports: [BusinessInsightsService],
})
export class BusinessInsightsModule {}