import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { StaffRoleCode } from "@prisma/client";

export class CreateStaffDto {
  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsEnum(StaffRoleCode)
  primaryRole!: StaffRoleCode;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(StaffRoleCode)
  primaryRole?: StaffRoleCode;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignRoleDto {
  @IsString()
  roleId!: string;
}
