import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthService } from "./auth.service.js";
import { StaffLoginDto } from "./dto/login.dto.js";
import { Public } from "./decorators/public.decorator.js";
import { CurrentStaff } from "./decorators/current-staff.decorator.js";
import { RequireRoles } from "./decorators/require-roles.decorator.js";
import { setAccessCookie } from "./cookie.util.js";
import type { AuthenticatedStaff } from "./types/auth.types.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Public()
  @Post("staff/login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async staffLogin(
    @Body() dto: StaffLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.staffLogin(dto.email, dto.password);
    // Set httpOnly cookie (8h)
    setAccessCookie(res, result.accessToken, 8 * 60 * 60 * 1000);
    // Return JSON body for bearer-token compatibility
    return result;
  }

  @Get("me")
  me(@CurrentStaff() staff: AuthenticatedStaff) {
    return staff;
  }

  @Get("admin-only")
  @RequireRoles("OWNER", "MANAGER")
  adminOnly(@CurrentStaff() staff: AuthenticatedStaff) {
    return { message: "You have admin access", staff };
  }
}
