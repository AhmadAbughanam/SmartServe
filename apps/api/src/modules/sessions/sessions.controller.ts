import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { SessionsService } from "./sessions.service.js";
import { StartSessionDto } from "./dto/start-session.dto.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("sessions")
export class SessionsController {
  constructor(
    @Inject(SessionsService)
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Start a session — public endpoint for QR/customer flow.
   *
   * In the QR flow, a customer scans a QR code that encodes branchId + tableCode.
   * The customer may or may not be authenticated.
   * If authenticated as a customer, the userId is attached.
   * If authenticated as staff, the createdByStaffId is attached.
   */
  @Public()
  @Post("start")
  async startSession(
    @Body() dto: StartSessionDto,
  ) {
    return this.sessionsService.startSession({
      branchId: dto.branchId,
      tableCode: dto.tableCode,
      guestCount: dto.guestCount,
      notes: dto.notes,
      location: dto.location,
      enforceGeoFence: true,
    });
  }

  /**
   * Staff-initiated session start with auth context.
   */
  @Post("staff/start")
  @RequirePermissions("sessions:write")
  async staffStartSession(
    @Body() dto: StartSessionDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.sessionsService.startSession({
      branchId: dto.branchId,
      tableCode: dto.tableCode,
      guestCount: dto.guestCount,
      notes: dto.notes,
      createdByStaffId: staff.staffId,
    });
  }

  @Get(":sessionId")
  @RequirePermissions("sessions:read")
  getSession(
    @Param("sessionId") sessionId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.sessionsService.getById(sessionId, staff.tenantId);
  }

  @Public()
  @Get(":sessionId/public")
  getPublicSessionSummary(@Param("sessionId") sessionId: string) {
    return this.sessionsService.getPublicSummary(sessionId);
  }

  @Post(":sessionId/end")
  @RequirePermissions("sessions:write")
  endSession(
    @Param("sessionId") sessionId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.sessionsService.endSession(sessionId, staff.tenantId);
  }
}
