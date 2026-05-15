import { Module } from "@nestjs/common";
import { TablesController } from "./tables.controller.js";
import { TablesService } from "./tables.service.js";

@Module({
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
