import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class PosOrderItemAdditionDto {
  @IsString()
  @IsNotEmpty()
  additionId!: string;
}

export class PosOrderItemDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemAdditionDto)
  additions?: PosOrderItemAdditionDto[];
}

export class CreatePosOrderDto {
  /** Existing session ID — if provided, the order is placed on this session. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionId?: string;

  /** If no sessionId, provide branchId + tableCode to auto-start a session. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  tableCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items!: PosOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
