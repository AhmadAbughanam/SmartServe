import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import { AuthService } from "../auth.service.js";
import { CustomerAuthService } from "../customer-auth.service.js";
import { TokenService } from "../token.service.js";
import { getAccessTokenFromCookie } from "../cookie.util.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly customerAuthService: CustomerAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing authorization token");
    }

    try {
      const payload = this.tokenService.verifyAccessToken(token);

      if (payload.type === "staff") {
        request.staff = await this.authService.resolveStaff(payload.sub);
      } else if (payload.type === "customer") {
        request.customer =
          await this.customerAuthService.resolveCustomer(payload.sub);
      } else {
        throw new UnauthorizedException("Invalid token type");
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid or expired token");
    }

    return true;
  }

  /**
   * Extract token from:
   * 1. Authorization: Bearer <token> header (priority)
   * 2. httpOnly cookie fallback (sro_access)
   */
  private extractToken(request: {
    headers: Record<string, string>;
    cookies?: Record<string, string>;
  }): string | undefined {
    // Bearer token takes priority (API clients, mobile, dev tools)
    const auth = request.headers["authorization"];
    if (auth) {
      const [scheme, token] = auth.split(" ");
      if (scheme === "Bearer" && token) return token;
    }

    // Cookie fallback (browser sessions)
    if (request.cookies) {
      const cookieToken = getAccessTokenFromCookie(request.cookies);
      if (cookieToken) return cookieToken;
    }

    return undefined;
  }
}
