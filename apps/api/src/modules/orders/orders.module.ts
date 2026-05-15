import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { LogsModule } from "../logs/logs.module.js";

@Module({
  imports: [LogsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
