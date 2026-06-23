import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { SaasAdminController } from "./saas-admin.controller.js";
import { SaasAdminGuard } from "./guards/saas-admin.guard.js";
import { SaasAdminService } from "./saas-admin.service.js";

@Module({
  imports: [AiModule],
  controllers: [SaasAdminController],
  providers: [SaasAdminService, SaasAdminGuard],
})
export class SaasAdminModule {}
