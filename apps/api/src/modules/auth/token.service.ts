import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  CustomerJwtPayload,
  JwtPayload,
  StaffJwtPayload,
} from "./types/auth.types.js";

@Injectable()
export class TokenService {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  signStaffAccessToken(
    payload: Omit<StaffJwtPayload, "iat" | "exp">,
  ): string {
    return this.jwt.sign(payload, { expiresIn: "8h" });
  }

  signCustomerAccessToken(
    payload: Omit<CustomerJwtPayload, "iat" | "exp">,
  ): string {
    return this.jwt.sign(payload, { expiresIn: "1h" });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }
}
