import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { PosController } from "./pos.controller.js";
import { PosService } from "./pos.service.js";

@Module({
  imports: [OrdersModule, SessionsModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
