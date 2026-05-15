import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type {
  ServiceRequestStatus,
  ServiceRequestType,
} from "@prisma/client";
import { ServiceRequestsService } from "./service-requests.service.js";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller()
export class ServiceRequestsController {
  constructor(
    @Inject(ServiceRequestsService)
    private readonly service: ServiceRequestsService,
  ) {}

  // ── Customer / public session endpoints ──────────────

  @Public()
  @Post("sessions/:sessionId/service-requests")
  create(
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.service.create(sessionId, dto.type);
  }

  @Public()
  @Get("sessions/:sessionId/service-requests")
  listForSession(@Param("sessionId") sessionId: string) {
    return this.service.listForSession(sessionId);
  }

  // ── Staff / waiter feed ──────────────────────────────

  @Get("service-requests")
  @RequirePermissions("service-requests:read")
  list(
    @Query("branchId") branchId: string,
    @Query("status") status: ServiceRequestStatus | undefined,
    @Query("type") type: ServiceRequestType | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.listForBranch(
      branchId || staff.branchId,
      staff.tenantId,
      staff.staffId,
      status,
      type,
    );
  }

  @Get("service-requests/:requestId")
  @RequirePermissions("service-requests:read")
  getById(
    @Param("requestId") requestId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.getById(requestId, staff.tenantId);
  }

  @Patch("service-requests/:requestId/claim")
  @RequirePermissions("service-requests:claim")
  claim(
    @Param("requestId") requestId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.claim(requestId, staff.tenantId, staff.staffId);
  }

  @Patch("service-requests/:requestId/complete")
  @RequirePermissions("service-requests:complete")
  complete(
    @Param("requestId") requestId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.complete(
      requestId,
      staff.tenantId,
      staff.staffId,
    );
  }

  @Patch("service-requests/:requestId/cancel")
  @RequirePermissions("service-requests:complete")
  cancel(
    @Param("requestId") requestId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.cancel(requestId, staff.tenantId);
  }
}
