import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { GlobalRole } from "@prisma/client";
import type { AuthenticatedSaasOwner } from "../../auth/types/auth.types.js";

@Injectable()
export class SaasAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const owner: AuthenticatedSaasOwner | undefined = request.saasOwner;

    if (owner?.globalRole !== GlobalRole.SAAS_OWNER) {
      throw new ForbiddenException("SaaS owner access required");
    }

    return true;
  }
}
