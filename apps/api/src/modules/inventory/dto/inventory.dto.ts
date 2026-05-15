import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentStock!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderLevel!: number;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdjustInventoryDto {
  @Type(() => Number)
  @IsNumber()
  delta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class MapMenuItemInventoryDto {
  @IsString()
  @IsNotEmpty()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qtyPerItem!: number;
}
