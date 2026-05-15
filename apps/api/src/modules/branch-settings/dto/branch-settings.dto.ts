import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, Max, Min } from "class-validator";
import { ServiceChargeType, type Prisma } from "@prisma/client";

export class UpdateBranchSettingsDto {
  @IsOptional()
  @IsBoolean()
  serviceChargeEnabled?: boolean;

  @IsOptional()
  @IsEnum(ServiceChargeType)
  serviceChargeType?: ServiceChargeType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  serviceChargeValue?: number;

  @IsOptional()
  @IsBoolean()
  tipsEnabled?: boolean;

  @IsOptional()
  @IsObject()
  tipPresetsJson?: Prisma.InputJsonObject;

  @IsOptional()
  @IsObject()
  paymentConfigJson?: Prisma.InputJsonObject;

  @IsOptional()
  @IsObject()
  featureFlagsJson?: Prisma.InputJsonObject;

  @IsOptional()
  @IsObject()
  aiConfigJson?: Prisma.InputJsonObject;
}
