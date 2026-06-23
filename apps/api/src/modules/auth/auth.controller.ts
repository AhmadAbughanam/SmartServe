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
import { env } from "../../config/env.js";
import { StaffLoginDto } from "./dto/login.dto.js";
import { Public } from "./decorators/public.decorator.js";
import { CurrentStaff } from "./decorators/current-staff.decorator.js";
import { RequireRoles } from "./decorators/require-roles.decorator.js";
import { clearAccessCookie, setAccessCookie, setCsrfCookie } from "./cookie.util.js";
import { createCsrfToken } from "./csrf.util.js";
import type { AuthenticatedStaff } from "./types/auth.types.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Public()
  @Get("csrf")
  csrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = createCsrfToken();
    setCsrfCookie(res, csrfToken);
    return { csrfToken };
  }

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
    setAccessCookie(res, result.accessToken, env.staffAccessCookieMaxAgeMs);
    // Return JSON body for bearer-token compatibility
    return result;
  }

  @Public()
  @Post("saas/login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async saasOwnerLogin(
    @Body() dto: StaffLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.saasOwnerLogin(dto.email, dto.password);
    setAccessCookie(res, result.accessToken, env.staffAccessCookieMaxAgeMs);
    return result;
  }

  @Public()
  @Post("saas/logout")
  @HttpCode(HttpStatus.OK)
  saasOwnerLogout(@Res({ passthrough: true }) res: Response) {
    clearAccessCookie(res);
    return { message: "Logged out successfully" };
  }

  @Public()
  @Post("staff/logout")
  @HttpCode(HttpStatus.OK)
  staffLogout(@Res({ passthrough: true }) res: Response) {
    clearAccessCookie(res);
    return { message: "Logged out successfully" };
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
