import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { TaxClass } from "@prisma/client";
import { CreateAdditionDto } from "./create-menu-item.dto.js";

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  dietaryInfo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsEnum(TaxClass)
  taxClass?: TaxClass;

  @IsOptional()
  @IsBoolean()
  isVegetarian?: boolean;

  @IsOptional()
  @IsBoolean()
  isSpicy?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdditionDto)
  additions?: CreateAdditionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
