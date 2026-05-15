import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class LogsQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  actionCode?: string;

  @IsOptional()
  @IsIn(["INFO", "WARN", "ERROR"])
  severity?: "INFO" | "WARN" | "ERROR";
}
