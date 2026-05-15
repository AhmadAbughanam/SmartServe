import { Controller, Get, Param, Inject } from "@nestjs/common";
import { TableAccessService } from "./table-access.service.js";
import { Public } from "../auth/decorators/public.decorator.js";

@Public()
@Controller("table-access")
export class TableAccessController {
  constructor(@Inject(TableAccessService) private readonly service: TableAccessService) {}

  @Get("branches/:branchId/tables")
  async listBranchTables(@Param("branchId") branchId: string) {
    return this.service.listBranchTables(branchId);
  }

  @Get(":code")
  async resolve(@Param("code") code: string) {
    return this.service.resolveCode(code);
  }
}
