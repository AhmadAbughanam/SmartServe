import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CustomerAuthService } from "./customer-auth.service.js";
import { OtpRequestDto } from "./dto/otp-request.dto.js";
import { OtpVerifyDto } from "./dto/otp-verify.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { Public } from "./decorators/public.decorator.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { setAccessCookie, setRefreshCookie, clearAuthCookies, getRefreshTokenFromCookie } from "./cookie.util.js";
import type { AuthenticatedCustomer } from "./types/auth.types.js";

@Controller("auth/customer")
export class CustomerAuthController {
  constructor(
    @Inject(CustomerAuthService)
    private readonly customerAuthService: CustomerAuthService,
  ) {}

  @Public()
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async requestOtp(@Body() dto: OtpRequestDto) {
    return this.customerAuthService.requestOtp(dto.phone);
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async verifyOtp(
    @Body() dto: OtpVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customerAuthService.verifyOtpAndLogin(dto.phone, dto.code);
    setAccessCookie(res, result.accessToken, 1 * 60 * 60 * 1000); // 1h
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Accept refresh token from body or cookie
    const refreshToken = dto.refreshToken || getRefreshTokenFromCookie(req.cookies ?? {});
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const result = await this.customerAuthService.refreshAccessToken(refreshToken);
    setAccessCookie(res, result.accessToken, 1 * 60 * 60 * 1000);
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken || getRefreshTokenFromCookie(req.cookies ?? {});
    if (refreshToken) {
      await this.customerAuthService.revokeRefreshToken(refreshToken);
    }
    clearAuthCookies(res);
    return { message: "Logged out successfully" };
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedCustomer) {
    return user;
  }
}
