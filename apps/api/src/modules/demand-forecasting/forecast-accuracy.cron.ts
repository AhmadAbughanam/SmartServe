import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service.js";
import { DemandForecastService } from "./demand-forecast.service.js";

@Injectable()
export class ForecastAccuracyCron {
  private readonly logger = new Logger(ForecastAccuracyCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: DemandForecastService
  ) {}

  // Run every night at 3:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async evaluateYesterdayForecasts() {
    this.logger.log("Starting forecast accuracy evaluation for yesterday.");

    try {
      const yesterdayUtc = new Date();
      yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
      const yesterdayStr = yesterdayUtc.toISOString().slice(0, 10);

      // Find all unique branches that were forecasted for yesterday
      const logs = await this.prisma.demandForecastLog.findMany({
        where: {
          forecastDate: {
            gte: new Date(`${yesterdayStr}T00:00:00Z`),
            lt: new Date(`${yesterdayStr}T23:59:59Z`),
          },
        },
        select: { tenantId: true, branchId: true, lookbackDays: true },
        distinct: ['branchId'],
      });

      if (logs.length === 0) {
        this.logger.log("No forecasts found for yesterday to evaluate.");
        return;
      }

      for (const log of logs) {
        try {
          // Re-generate the forecast for yesterday to get deterministic item expectations
          // We use a dummy staff object since this is a system job
          const forecast = await this.forecastService.getDemandForecast(
            { branchId: log.branchId, date: yesterdayStr, lookbackDays: log.lookbackDays },
            { staffId: "system", tenantId: log.tenantId, branchId: log.branchId, primaryRole: "OWNER", permissions: [] } as any
          );

          // Get actual orders for yesterday
          const actualOrdersRaw = await this.prisma.order.findMany({
            where: {
              tenantId: log.tenantId,
              branchId: log.branchId,
              orderDateTime: {
                gte: new Date(`${yesterdayStr}T00:00:00Z`),
                lt: new Date(`${yesterdayStr}T23:59:59Z`),
              },
              OR: [
                { orderStatus: { in: ["SERVED", "COMPLETED"] } },
                { paymentStatus: "PAID" },
              ],
            },
            include: { orderItems: true },
          });

          const actualOrders = actualOrdersRaw.length;
          let actualRevenue = 0;
          const actualItemQty = new Map<string, number>();

          for (const order of actualOrdersRaw) {
            actualRevenue += Number(order.totalAmount || 0); // fallback to 0 if undefined
            for (const item of order.orderItems) {
              actualItemQty.set(item.menuItemId, (actualItemQty.get(item.menuItemId) || 0) + item.quantity);
            }
          }

          const itemAccuracy = forecast.items.map(fi => ({
            menuItemId: fi.menuItemId,
            expectedQty: fi.expectedQuantity,
            actualQty: actualItemQty.get(fi.menuItemId) || 0,
          }));

          await this.prisma.demandForecastAccuracy.create({
            data: {
              tenantId: log.tenantId,
              branchId: log.branchId,
              date: new Date(`${yesterdayStr}T12:00:00Z`),
              lookbackDays: log.lookbackDays,
              forecastedOrders: forecast.expectedOrders,
              actualOrders,
              forecastedRevenue: forecast.expectedRevenue,
              actualRevenue,
              itemAccuracy: itemAccuracy as any,
            }
          });

          this.logger.log(`Accuracy recorded for branch ${log.branchId} on ${yesterdayStr}. Expected: ${forecast.expectedOrders}, Actual: ${actualOrders}`);
        } catch (branchError) {
          this.logger.error(`Failed to evaluate branch ${log.branchId}`, branchError);
        }
      }
    } catch (error) {
      this.logger.error("Failed to evaluate forecast accuracy", error);
    }
  }
}
