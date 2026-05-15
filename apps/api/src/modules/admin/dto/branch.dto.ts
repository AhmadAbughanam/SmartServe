import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateBranchDto {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  geofenceRadiusM?: number;

  @IsOptional()
  @IsBoolean()
  geofenceEnabled?: boolean;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  geofenceRadiusM?: number;

  @IsOptional()
  @IsBoolean()
  geofenceEnabled?: boolean;
}
