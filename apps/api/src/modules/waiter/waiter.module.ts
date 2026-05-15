import { Module } from "@nestjs/common";
import { WaiterController } from "./waiter.controller.js";
import { WaiterService } from "./waiter.service.js";
import { OrdersModule } from "../orders/orders.module.js";

@Module({
  imports: [OrdersModule],
  controllers: [WaiterController],
  providers: [WaiterService],
  exports: [WaiterService],
})
export class WaiterModule {}
