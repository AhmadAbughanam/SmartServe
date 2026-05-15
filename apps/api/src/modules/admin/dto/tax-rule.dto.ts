import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { TaxClass } from "@prisma/client";

export class CreateTaxRuleDto {
  @IsString()
  branchId!: string;

  @IsEnum(TaxClass)
  taxClass!: TaxClass;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent!: number;
}

export class UpdateTaxRuleDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
