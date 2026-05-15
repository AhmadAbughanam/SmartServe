import { Module } from "@nestjs/common";
import { KdsController } from "./kds.controller.js";
import { KdsService } from "./kds.service.js";
import { NotificationsModule } from "../notifications/notifications.module.js";

@Module({
  imports: [NotificationsModule],
  controllers: [KdsController],
  providers: [KdsService],
  exports: [KdsService],
})
export class KdsModule {}
