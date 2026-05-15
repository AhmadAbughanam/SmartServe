import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { DeviceType, type Prisma } from "@prisma/client";

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(DeviceType)
  deviceType!: DeviceType;

  @IsOptional()
  @IsObject()
  capabilitiesJson?: Prisma.InputJsonObject;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(DeviceType)
  deviceType?: DeviceType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  capabilitiesJson?: Prisma.InputJsonObject;
}
