import { IsArray, IsString } from "class-validator";

export class CreateRoleDto {
  @IsString()
  roleName!: string;
}

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}
