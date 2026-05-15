import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
