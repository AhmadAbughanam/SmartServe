import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedStaff } from "../types/auth.types.js";

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedStaff => {
    const request = ctx.switchToHttp().getRequest();
    return request.staff as AuthenticatedStaff;
  },
);
