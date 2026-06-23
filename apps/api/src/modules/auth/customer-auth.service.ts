import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import { env } from "../../config/env.js";
import { TokenService } from "./token.service.js";
import { generateOtp, hashOtp, verifyOtp } from "./otp.util.js";
import type { AuthenticatedCustomer } from "./types/auth.types.js";
import { SmsService } from "./sms.service.js";
import { MetricsService } from "../metrics/metrics.service.js";

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(SmsService) private readonly smsService: SmsService,
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  async requestOtp(phone: string) {
    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpRequest.create({
      data: { phone, codeHash, expiresAt },
    });

    await this.smsService.send({
      to: phone,
      purpose: "CUSTOMER_OTP",
      body: `Your Smart Restaurant verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    });
    this.metricsService.recordOtpRequest("issued");

    // DEV ONLY: expose the OTP in the response so it can be used without an SMS provider.
    // In production it is sent via SMS and never returned.
    const isDev = env.nodeEnv === "development";
    if (isDev) {
      this.logger.warn(`[DEV] OTP for ${phone}: ${otp}`);
    }

    return {
      message: "OTP sent",
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      ...(isDev ? { _dev_otp: otp } : {}),
    };
  }

  async verifyOtpAndLogin(phone: string, code: string) {
    // Find the most recent non-expired, non-verified OTP for this phone.
    const otpRecord = await this.prisma.otpRequest.findFirst({
      where: {
        phone,
        expiresAt: { gt: new Date() },
        verifiedAt: null,
      },
      orderBy: { expiresAt: "desc" },
    });

    if (!otpRecord) {
      this.metricsService.recordOtpVerification("failed");
      throw new UnauthorizedException("No valid OTP found. Request a new one.");
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      this.metricsService.recordOtpVerification("blocked");
      throw new UnauthorizedException(
        "Too many attempts. Request a new OTP.",
      );
    }

    // Increment attempt count before checking
    await this.prisma.otpRequest.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    const valid = await verifyOtp(code, otpRecord.codeHash);
    if (!valid) {
      this.metricsService.recordOtpVerification("failed");
      throw new UnauthorizedException("Invalid OTP code");
    }
    this.metricsService.recordOtpVerification("succeeded");

    // Mark OTP as verified
    await this.prisma.otpRequest.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    // Find or create user
    let user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, name: phone },
      });
    }

    if (user.isBlocked) {
      throw new UnauthorizedException("Account is blocked");
    }

    // Update last visit
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastVisitAt: new Date() },
    });

    const accessToken = this.tokenService.signCustomerAccessToken({
      sub: user.id,
      phone: user.phone,
      type: "customer",
    });

    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
      },
    };
  }

  async refreshAccessToken(refreshTokenValue: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: refreshTokenValue },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (record.revokedAt) {
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token has expired");
    }

    if (record.user.isBlocked) {
      throw new UnauthorizedException("Account is blocked");
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = this.tokenService.signCustomerAccessToken({
      sub: record.user.id,
      phone: record.user.phone,
      type: "customer",
    });

    const newRefreshToken = await this.createRefreshToken(record.user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: record.user.id,
        phone: record.user.phone,
        name: record.user.name,
      },
    };
  }

  async revokeRefreshToken(refreshTokenValue: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: refreshTokenValue },
    });

    if (!record || record.revokedAt) {
      return { message: "Token already revoked or does not exist" };
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return { message: "Logged out successfully" };
  }

  async resolveCustomer(userId: string): Promise<AuthenticatedCustomer> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      userId: user.id,
      phone: user.phone,
      name: user.name,
      globalRole: user.globalRole,
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    );

    const record = await this.prisma.refreshToken.create({
      data: { userId, expiresAt },
    });

    return record.id;
  }
}
