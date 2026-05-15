import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { GeoFenceLocationInputDto } from "../../geofencing/dto/geofence-check-request.dto.js";

export class StartSessionDto {
  @IsString()
  branchId!: string;

  @IsString()
  tableCode!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoFenceLocationInputDto)
  location?: GeoFenceLocationInputDto;
}
