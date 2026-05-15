import { IsDateString, IsIn, IsOptional, IsString, Matches } from "class-validator";

export class BusinessInsightsQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsIn(["BRANCH", "TENANT"])
  scope?: "BRANCH" | "TENANT";

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}
