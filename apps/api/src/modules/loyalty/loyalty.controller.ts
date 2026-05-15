import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { LoyaltyService } from "./loyalty.service.js";
import {
  CreateLoyaltyRewardDto,
  ManualLoyaltyAdjustmentDto,
  UpdateLoyaltyProgramDto,
  UpdateLoyaltyRewardDto,
} from "./dto/loyalty.dto.js";

@Controller("admin/loyalty")
export class LoyaltyController {
  constructor(
    @Inject(LoyaltyService)
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Get("program")
  @RequirePermissions("promotions:read")
  getProgram(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.loyaltyService.getProgram(staff.tenantId);
  }

  @Patch("program")
  @RequirePermissions("promotions:write")
  updateProgram(
    @Body() dto: UpdateLoyaltyProgramDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.loyaltyService.updateProgram(staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Get("rewards")
  @RequirePermissions("promotions:read")
  listRewards(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.loyaltyService.listRewards(staff.tenantId);
  }

  @Post("rewards")
  @RequirePermissions("promotions:write")
  createReward(
    @Body() dto: CreateLoyaltyRewardDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.loyaltyService.createReward(staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Patch("rewards/:rewardId")
  @RequirePermissions("promotions:write")
  updateReward(
    @Param("rewardId") rewardId: string,
    @Body() dto: UpdateLoyaltyRewardDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.loyaltyService.updateReward(rewardId, staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Delete("rewards/:rewardId")
  @RequirePermissions("promotions:write")
  deleteReward(
    @Param("rewardId") rewardId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.loyaltyService.deleteReward(rewardId, staff.tenantId, staff.staffId, staff.branchId);
  }

  @Get("members")
  @RequirePermissions("promotions:read")
  listMembers(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.loyaltyService.listMembers(staff.tenantId);
  }

  @Post("members/:userId/adjustments")
  @RequirePermissions("promotions:write")
  adjustMember(
    @Param("userId") userId: string,
    @Body() dto: ManualLoyaltyAdjustmentDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.loyaltyService.adjustMember(userId, staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Post("members/:userId/rewards/:rewardId/redeem")
  @RequirePermissions("promotions:write")
  redeemRewardForMember(
    @Param("userId") userId: string,
    @Param("rewardId") rewardId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.loyaltyService.redeemRewardForMember(userId, rewardId, staff.tenantId);
  }
}
