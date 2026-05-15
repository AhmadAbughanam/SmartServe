import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ShiftsService } from "./shifts.service.js";
import { CloseTillDto } from "./dto/close-till.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("shifts")
export class ShiftsController {
  constructor(
    @Inject(ShiftsService) private readonly shiftsService: ShiftsService,
  ) {}

  // ── Shifts ───────────────────────────────────────────

  @Post("open")
  @RequirePermissions("shifts:write")
  openShift(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.shiftsService.openShift(
      staff.staffId,
      staff.tenantId,
      staff.branchId,
    );
  }

  @Post(":shiftId/close")
  @RequirePermissions("shifts:write")
  closeShift(
    @Param("shiftId") shiftId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.shiftsService.closeShift(
      shiftId,
      staff.tenantId,
      staff.staffId,
    );
  }

  @Get("open")
  @RequirePermissions("shifts:read")
  getOpenShift(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.shiftsService.getOpenShift(
      staff.staffId,
      staff.branchId,
    );
  }

  @Get()
  @RequirePermissions("shifts:read")
  listShifts(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.shiftsService.listShifts(
      branchId || staff.branchId,
      staff.tenantId,
    );
  }

  // ── Attendance ───────────────────────────────────────

  @Post("attendance/check-in")
  @RequirePermissions("attendance:write")
  checkIn(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.shiftsService.checkIn(
      staff.staffId,
      staff.tenantId,
      staff.branchId,
    );
  }

  @Post("attendance/check-out")
  @RequirePermissions("attendance:write")
  checkOut(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.shiftsService.checkOut(staff.staffId, staff.branchId);
  }

  @Get("attendance/me")
  @RequirePermissions("attendance:write")
  getMyAttendance(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.shiftsService.getMyAttendance(
      staff.staffId,
      staff.branchId,
    );
  }

  // ── Till ─────────────────────────────────────────────

  @Post(":shiftId/till/close")
  @RequirePermissions("tills:write")
  closeTill(
    @Param("shiftId") shiftId: string,
    @Body() dto: CloseTillDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.shiftsService.closeTill(
      shiftId,
      dto.actualCash,
      staff.tenantId,
      staff.staffId,
    );
  }

  @Get(":shiftId/till")
  @RequirePermissions("tills:read")
  getTill(
    @Param("shiftId") shiftId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.shiftsService.getTill(shiftId, staff.tenantId);
  }
}
