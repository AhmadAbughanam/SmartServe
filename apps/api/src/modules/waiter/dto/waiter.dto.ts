import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";

export class WaiterQuickAddSpecializationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
}

export class WaiterQuickAddItemDto {
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
  @Type(() => WaiterQuickAddSpecializationDto)
  specializations?: WaiterQuickAddSpecializationDto[];
}

export class WaiterQuickAddDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WaiterQuickAddItemDto)
  items!: WaiterQuickAddItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;
}

export class WaiterPaymentConfirmDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}

export class WaiterUpdateQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class WaiterCancelItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class WaiterSurchargeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class WaiterNotesDto {
  @IsString()
  @MaxLength(500)
  notes!: string;
}
