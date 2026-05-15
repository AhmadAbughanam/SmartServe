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

export class OrderItemAdditionDto {
  @IsString()
  @IsNotEmpty()
  additionId!: string;
}

export class CreateOrderItemDto {
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
  @Type(() => OrderItemAdditionDto)
  additions?: OrderItemAdditionDto[];
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
