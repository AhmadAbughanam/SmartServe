import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { RequestLoggerMiddleware } from "./common/request-logger.middleware.js";
import { MetricsModule } from "./modules/metrics/metrics.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { AnalyticsModule } from "./modules/analytics/analytics.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./health/health.module.js";
import { IntegrationsModule } from "./modules/integrations/integrations.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { KdsModule } from "./modules/kds/kds.module.js";
import { LoyaltyModule } from "./modules/loyalty/loyalty.module.js";
import { LogsModule } from "./modules/logs/logs.module.js";
import { PromotionsModule } from "./modules/promotions/promotions.module.js";
import { MenuModule } from "./modules/menu/menu.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { PosModule } from "./modules/pos/pos.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RealtimeModule } from "./modules/realtime/realtime.module.js";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module.js";
import { ReportingModule } from "./modules/reporting/reporting.module.js";
import { RolesModule } from "./modules/roles/roles.module.js";
import { ServiceRequestsModule } from "./modules/service-requests/service-requests.module.js";
import { SessionsModule } from "./modules/sessions/sessions.module.js";
import { ShiftsModule } from "./modules/shifts/shifts.module.js";
import { TablesModule } from "./modules/tables/tables.module.js";
import { DevicesModule } from "./modules/devices/devices.module.js";
import { DemandForecastingModule } from "./modules/demand-forecasting/demand-forecasting.module.js";
import { BranchSettingsModule } from "./modules/branch-settings/branch-settings.module.js";
import { BusinessInsightsModule } from "./modules/business-insights/business-insights.module.js";
import { TableAccessModule } from "./modules/table-access/table-access.module.js";
import { ReviewsModule } from "./modules/reviews/reviews.module.js";
import { WaiterModule } from "./modules/waiter/waiter.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { GeoFencingModule } from "./modules/geofencing/geofencing.module.js";
import { SaasAdminModule } from "./modules/saas-admin/saas-admin.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    MetricsModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    RolesModule,
    TablesModule,
    SessionsModule,
    MenuModule,
    OrdersModule,
    KdsModule,
    PaymentsModule,
    PosModule,
    ShiftsModule,
    ServiceRequestsModule,
    AnalyticsModule,
    ReportingModule,
    RecommendationsModule,
    RealtimeModule,
    InventoryModule,
    LoyaltyModule,
    LogsModule,
    IntegrationsModule,
    AdminModule,
    PromotionsModule,
    AiModule,
    DemandForecastingModule,
    BusinessInsightsModule,
    DevicesModule,
    BranchSettingsModule,
    TableAccessModule,
    ReviewsModule,
    WaiterModule,
    NotificationsModule,
    GeoFencingModule,
    SaasAdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
