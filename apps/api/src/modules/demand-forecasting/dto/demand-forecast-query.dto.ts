import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

export class DemandForecastQueryDto {
  @IsString()
  branchId!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  kitchenStationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(180)
  lookbackDays?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  weatherAdjustment?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  eventAdjustment?: number;
}
