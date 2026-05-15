import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { GeoFenceAction } from "@smart-restaurant/shared-types";

export class GeoFenceLocationInputDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;
}

export class GeoFenceCheckRequestDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsIn(["START_TABLE_SESSION", "STAFF_CHECK_IN", "WAITER_ACTION"])
  action!: GeoFenceAction;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoFenceLocationInputDto)
  location?: GeoFenceLocationInputDto;
}
