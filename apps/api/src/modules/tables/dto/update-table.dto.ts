import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength, Max } from "class-validator";
import { Type } from "class-transformer";

export class UpdateTableDto {
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
}
