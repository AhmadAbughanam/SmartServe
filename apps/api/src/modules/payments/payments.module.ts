import { Module } from "@nestjs/common";
import { LoyaltyModule } from "../loyalty/loyalty.module.js";
import { LogsModule } from "../logs/logs.module.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

@Module({
  imports: [LoyaltyModule, LogsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
