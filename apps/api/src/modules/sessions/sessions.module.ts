import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller.js";
import { SessionsService } from "./sessions.service.js";
import { GeoFencingModule } from "../geofencing/geofencing.module.js";

@Module({
  imports: [GeoFencingModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
