import { Module } from "@nestjs/common";
import { ServiceRequestsController } from "./service-requests.controller.js";
import { ServiceRequestsService } from "./service-requests.service.js";
import { LogsModule } from "../logs/logs.module.js";

@Module({
  imports: [LogsModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
