import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedCustomer } from "../types/auth.types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
    const request = ctx.switchToHttp().getRequest();
    return request.customer as AuthenticatedCustomer;
  },
);
