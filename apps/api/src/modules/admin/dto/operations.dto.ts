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
