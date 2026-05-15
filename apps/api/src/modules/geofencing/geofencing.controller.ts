import { Body, Controller, Inject, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator.js";
import { GeoFenceCheckRequestDto } from "./dto/geofence-check-request.dto.js";
import { GeoFencingService } from "./geofencing.service.js";

@Controller("geofencing")
export class GeoFencingController {
  constructor(
    @Inject(GeoFencingService)
    private readonly geoFencingService: GeoFencingService,
  ) {}

  @Public()
  @Post("check")
  check(@Body() dto: GeoFenceCheckRequestDto) {
    return this.geoFencingService.check(dto);
  }
}
