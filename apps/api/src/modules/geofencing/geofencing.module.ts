import { Module } from "@nestjs/common";
import { LogsModule } from "../logs/logs.module.js";
import { GeoFencingController } from "./geofencing.controller.js";
import { GeoFencingService } from "./geofencing.service.js";

@Module({
  imports: [LogsModule],
  controllers: [GeoFencingController],
  providers: [GeoFencingService],
  exports: [GeoFencingService],
})
export class GeoFencingModule {}
