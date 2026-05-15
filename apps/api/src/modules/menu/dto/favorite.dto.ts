import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export class SetFavoriteDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsBoolean()
  favorite!: boolean;
}
