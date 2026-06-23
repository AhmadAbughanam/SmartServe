import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  CustomerJwtPayload,
  JwtPayload,
  SaasOwnerJwtPayload,
  StaffJwtPayload,
} from "./types/auth.types.js";
import { env } from "../../config/env.js";

@Injectable()
export class TokenService {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  signStaffAccessToken(
    payload: Omit<StaffJwtPayload, "iat" | "exp">,
  ): string {
    return this.jwt.sign(payload, { expiresIn: env.staffAccessTokenTtl as any });
  }

  signCustomerAccessToken(
    payload: Omit<CustomerJwtPayload, "iat" | "exp">,
  ): string {
    return this.jwt.sign(payload, { expiresIn: "1h" });
  }

  signSaasOwnerAccessToken(
    payload: Omit<SaasOwnerJwtPayload, "iat" | "exp">,
  ): string {
    return this.jwt.sign(payload, { expiresIn: env.staffAccessTokenTtl as any });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }
}
