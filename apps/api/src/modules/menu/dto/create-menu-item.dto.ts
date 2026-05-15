import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { TaxClass } from "@prisma/client";

export class CreateAdditionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceImpact!: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSelectable?: number;
}

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ingredients?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dietaryInfo?: string;

  @IsOptional()
  @IsBoolean()
  isVegetarian?: boolean;

  @IsOptional()
  @IsBoolean()
  isSpicy?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsEnum(TaxClass)
  taxClass?: TaxClass;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdditionDto)
  additions?: CreateAdditionDto[];
}
