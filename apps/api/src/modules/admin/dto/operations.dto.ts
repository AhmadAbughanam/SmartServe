import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TableShape } from "@prisma/client";

export class CreateAdminTableDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  tableCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  zone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  posX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  posY?: number;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;
}

export class UpdateAdminTableDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  tableCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  zone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  posX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  posY?: number;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;
}

export class AdminEditOrderDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  cancelItemIds?: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  reason!: string;
}

export class ResolveLowStockAlertDto {
  @IsIn(["ACKNOWLEDGED", "RESOLVED"])
  status!: "ACKNOWLEDGED" | "RESOLVED";
}
