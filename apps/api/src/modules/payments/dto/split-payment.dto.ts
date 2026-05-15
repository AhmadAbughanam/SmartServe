import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";
import { SplitType } from "@prisma/client";

export class SplitPaymentRequestDto {
  @IsEnum(SplitType)
  splitType!: SplitType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Min(0.01, { each: true })
  customAmounts?: number[];
}
