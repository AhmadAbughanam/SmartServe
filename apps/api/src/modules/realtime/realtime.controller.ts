import { Controller, ForbiddenException, Inject, Param, Req, Sse } from "@nestjs/common";
import { Observable, map } from "rxjs";
import type { Request } from "express";
import { RealtimeService } from "./realtime.service.js";
import { TokenService } from "../auth/token.service.js";
import { AuthService } from "../auth/auth.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { getAccessTokenFromCookie } from "../auth/cookie.util.js";

interface MessageEvent {
  data: string | object;
  type?: string;
  id?: string;
}

@Controller("realtime")
export class RealtimeController {
  constructor(
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  /**
   * SSE endpoint for branch-level events.
   * Requires staff auth — token from query param, cookie, or Authorization header.
   * Validates staff belongs to the requested branch's tenant.
   */
  @Public() // Bypass global guard — we handle auth manually for SSE
  @Sse("branches/:branchId/events")
  async branchEvents(
    @Param("branchId") branchId: string,
    @Req() req: Request,
  ): Promise<Observable<MessageEvent>> {
    // Extract token from: query param (SSE can't set headers from EventSource) > cookie > bearer
    const token =
      (req.query["token"] as string) ||
      getAccessTokenFromCookie(req.cookies ?? {}) ||
      req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      throw new ForbiddenException("Authentication required for branch events");
    }

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      if (payload.type !== "staff") {
        throw new ForbiddenException("Staff authentication required");
      }
      const staff = await this.authService.resolveStaff(payload.sub);
      await this.branchAccess.assertUserCanAccessBranch(staff, branchId);
    } catch {
      throw new ForbiddenException("Invalid or expired token");
    }

    return this.realtimeService.branchEvents$(branchId).pipe(
      map((event) => ({
        type: event.name,
        data: JSON.stringify(event),
      })),
    );
  }

  /**
   * SSE endpoint for session-level events.
   * Remains public — sessionId is unguessable (cuid) and data is
   * limited to order status updates for that session only.
   */
  @Public()
  @Sse("sessions/:sessionId/events")
  sessionEvents(
    @Param("sessionId") sessionId: string,
  ): Observable<MessageEvent> {
    return this.realtimeService.sessionEvents$(sessionId).pipe(
      map((event) => ({
        type: event.name,
        data: JSON.stringify(event),
      })),
    );
  }
}
