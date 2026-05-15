import { Module } from "@nestjs/common";
import { BranchSettingsController } from "./branch-settings.controller.js";
import { BranchSettingsService } from "./branch-settings.service.js";

@Module({
  controllers: [BranchSettingsController],
  providers: [BranchSettingsService],
  exports: [BranchSettingsService],
})
export class BranchSettingsModule {}
