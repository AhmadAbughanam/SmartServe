import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { WasteReason, WasteType } from "@prisma/client";

export class RecordWasteDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderItemId?: string;

  @IsEnum(WasteType)
  type!: WasteType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsEnum(WasteReason)
  reasonCode!: WasteReason;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
