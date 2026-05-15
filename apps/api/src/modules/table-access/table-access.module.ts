import { Module } from "@nestjs/common";
import { TableAccessController } from "./table-access.controller.js";
import { TableAccessService } from "./table-access.service.js";

@Module({
  controllers: [TableAccessController],
  providers: [TableAccessService],
  exports: [TableAccessService],
})
export class TableAccessModule {}
