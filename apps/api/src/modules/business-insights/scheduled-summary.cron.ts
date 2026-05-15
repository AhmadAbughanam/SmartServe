import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BusinessInsightsService } from './business-insights.service.js';

@Injectable()
export class ScheduledSummaryCron {
  private readonly logger = new Logger(ScheduledSummaryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: BusinessInsightsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async generateDailySummaries() {
    this.logger.log('Starting daily scheduled business summaries generation.');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

      // We only look for active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      for (const tenant of tenants) {
        try {
          // 1. Generate Tenant-wide summary
          const tenantSummary = await this.insightsService.generateInsights(
            tenant.id,
            'system-cron',
            'TENANT',
            undefined,
            startOfDay,
            endOfDay
          );

          await this.prisma.scheduledBusinessSummary.create({
            data: {
              tenantId: tenant.id,
              frequency: 'DAILY',
              reportDate: startOfDay,
              snapshotJson: tenantSummary as any,
              status: 'GENERATED'
            }
          });

          // 2. Generate Branch-specific summaries
          const branches = await this.prisma.branch.findMany({
            where: { tenantId: tenant.id, isActive: true },
            select: { id: true }
          });

          for (const branch of branches) {
            try {
              const branchSummary = await this.insightsService.generateInsights(
                tenant.id,
                'system-cron',
                'BRANCH',
                branch.id,
                startOfDay,
                endOfDay
              );

              await this.prisma.scheduledBusinessSummary.create({
                data: {
                  tenantId: tenant.id,
                  branchId: branch.id,
                  frequency: 'DAILY',
                  reportDate: startOfDay,
                  snapshotJson: branchSummary as any,
                  status: 'GENERATED'
                }
              });
              
              // Notification for branch managers
              await this.prisma.notification.create({
                data: {
                   tenantId: tenant.id,
                   branchId: branch.id,
                   type: 'REPORT',
                   title: 'Daily Business Summary Available',
                   body: `Your daily business summary for ${startOfDay.toISOString().slice(0,10)} is ready. Found ${branchSummary.insights.length} insights.`
                }
              });
              
            } catch (err) {
              this.logger.error(`Failed to generate daily summary for branch ${branch.id}`, err);
            }
          }
        } catch (err) {
          this.logger.error(`Failed to generate daily summary for tenant ${tenant.id}`, err);
        }
      }

      this.logger.log('Finished daily scheduled business summaries generation.');
    } catch (error) {
      this.logger.error('Failed to run daily scheduled business summaries generation', error);
    }
  }
}
